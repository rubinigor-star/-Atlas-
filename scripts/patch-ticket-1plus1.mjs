import fs from "node:fs";

function patch(path,replacements){
 let source=fs.readFileSync(path,"utf8");
 for(const [from,to] of replacements){
  if(!source.includes(from)){
   if(source.includes(to))continue;
   console.warn(`[1+1 patch] Skipping outdated target in ${path}: ${from.slice(0,80)}`);
   continue;
  }
  source=source.replace(from,to);
 }
 fs.writeFileSync(path,source);
}

patch("src/app/events/[slug]/page.tsx",[
 ["import { parsePricingMarketingStrategy, stripPricingMarketingStrategy } from \"@/lib/ticket-pricing-strategy\";","import { parsePricingMarketingStrategy, stripPricingMarketingStrategy } from \"@/lib/ticket-pricing-strategy\";\nimport { parseTicketSalesStrategy, stripTicketSalesStrategy } from \"@/lib/ticket-sales-strategy\";"],
 ["description: stripPricingMarketingStrategy(category.description),","description: stripTicketSalesStrategy(stripPricingMarketingStrategy(category.description)),\n        salesStrategy: parseTicketSalesStrategy(category.description),"]
]);

patch("src/components/event-purchase.tsx",[
 ["import type { PricingMarketingStrategy } from \"@/lib/ticket-pricing-strategy\";","import type { PricingMarketingStrategy } from \"@/lib/ticket-pricing-strategy\";\nimport type { TicketSalesStrategy } from \"@/lib/ticket-sales-strategy\";"],
 ["type Category = { id: string; name: string; description: string | null; priceMinor: number; colorHex: string; capacity: number; sold: number; pricingPresentation: PricingPresentation; marketingStrategy: PricingMarketingStrategy };","type Category = { id: string; name: string; description: string | null; priceMinor: number; colorHex: string; capacity: number; sold: number; pricingPresentation: PricingPresentation; marketingStrategy: PricingMarketingStrategy; salesStrategy: TicketSalesStrategy };"],
 ["  const subtotal = useMemo(() => {\n    if (allocation?.customPriceMinor !== null && allocation?.customPriceMinor !== undefined && allocation.type === \"TABLE\" && wholeObject) return allocation.customPriceMinor;\n    if (wholeObject) return categories.find((item) => item.id === wholeObject.categoryId)?.priceMinor ?? wholeObject.priceMinor;\n    if (selectedSeats.length) return selectedSeats.reduce((sum, seat) => sum + (categories.find((item) => item.id === seat.categoryId)?.priceMinor ?? 0), 0);\n    return (category?.priceMinor ?? 0) * qty;\n  }, [wholeObject, selectedSeats, categories, category, qty, allocation]);","  const subtotal = useMemo(() => {\n    if (allocation?.customPriceMinor !== null && allocation?.customPriceMinor !== undefined && allocation.type === \"TABLE\" && wholeObject) return allocation.customPriceMinor;\n    if (wholeObject) return categories.find((item) => item.id === wholeObject.categoryId)?.priceMinor ?? wholeObject.priceMinor;\n    if (selectedSeats.length) {\n      const grouped=new Map<string,number>();\n      for(const seat of selectedSeats)if(seat.categoryId)grouped.set(seat.categoryId,(grouped.get(seat.categoryId)??0)+1);\n      return [...grouped.entries()].reduce((sum,[id,count])=>{const item=categories.find(category=>category.id===id);if(!item)return sum;return sum+item.priceMinor*(item.salesStrategy===\"BUY_ONE_GET_ONE\"?count/2:count);},0);\n    }\n    return (category?.priceMinor ?? 0) * qty;\n  }, [wholeObject, selectedSeats, categories, category, qty, allocation]);"],
 ["  function go() {\n    if (!categoryId || (seatObject && selectedSeatIds.length === 0)) return;\n    const quantity = wholeObject ? wholeObject.seats : seatObject ? selectedSeatIds.length : qty;","  function go() {\n    if (!categoryId || (seatObject && selectedSeatIds.length === 0)) return;\n    const activeCategory=categories.find(item=>item.id===categoryId);\n    if(wholeObject&&activeCategory?.salesStrategy===\"BUY_ONE_GET_ONE\")return;\n    if(seatObject&&activeCategory?.salesStrategy===\"BUY_ONE_GET_ONE\"&&selectedSeatIds.length%2!==0)return;\n    const quantity = wholeObject ? wholeObject.seats : seatObject ? selectedSeatIds.length : qty*(activeCategory?.salesStrategy===\"BUY_ONE_GET_ONE\"?2:1);"],
 ["        <span><strong>{item.name}</strong><br /><small className=\"muted\">{item.description}</small>","        <span><strong>{item.name} {item.salesStrategy===\"BUY_ONE_GET_ONE\"&&<span className=\"pill\">1+1</span>}</strong><br /><small className=\"muted\">{item.description}</small>"],
 ["        </span><strong>{money(finalUnitPrice,\"ILS\",locale)}</strong>","        </span><strong>{money(finalUnitPrice,\"ILS\",locale)}{item.salesStrategy===\"BUY_ONE_GET_ONE\"&&<small className=\"muted\" style={{display:\"block\"}}>{locale===\"he\"?\"ל-2 כרטיסים\":locale===\"en\"?\"for 2 tickets\":\"за 2 билета\"}</small>}</strong>"],
 ["    {!selectionObject && <div className=\"field\" style={{ marginTop: 16 }}><label>{common.quantity}</label>","    {!selectionObject && <div className=\"field\" style={{ marginTop: 16 }}><label>{category?.salesStrategy===\"BUY_ONE_GET_ONE\"?(locale===\"he\"?\"מספר חבילות 1+1\":locale===\"en\"?\"Number of 1+1 bundles\":\"Количество комплектов 1+1\"):common.quantity}</label>"],
 ["<button className=\"btn\" disabled={Boolean(seatObject) && selectedSeatIds.length === 0} onClick={go}>{common.continue}</button>","<button className=\"btn\" disabled={(Boolean(seatObject) && selectedSeatIds.length === 0)||(category?.salesStrategy===\"BUY_ONE_GET_ONE\"&&Boolean(seatObject)&&selectedSeatIds.length%2!==0)||(category?.salesStrategy===\"BUY_ONE_GET_ONE\"&&Boolean(wholeObject))} onClick={go}>{common.continue}</button>"]
]);

patch("src/app/checkout/page.tsx",[
 ["import { calculateServiceFee } from \"@/lib/service-fee\";","import { calculateServiceFee } from \"@/lib/service-fee\";\nimport { parseTicketSalesStrategy, salesStrategySubtotal } from \"@/lib/ticket-sales-strategy\";"],
 ["  const regularTotal=table?.category\n    ? effectiveTicketPrice(table.category,now)\n    : seats.length\n      ? seats.reduce((sum,seat)=>sum+effectiveTicketPrice(seat.category!,now),0)\n      : effectiveTicketPrice(category,now)*quantity;","  const salesStrategy=parseTicketSalesStrategy(category.description);\n  if(table&&salesStrategy===\"BUY_ONE_GET_ONE\")notFound();\n  if(salesStrategy===\"BUY_ONE_GET_ONE\"&&quantity%2!==0)notFound();\n  const regularTotal=table?.category\n    ? effectiveTicketPrice(table.category,now)\n    : seats.length\n      ? salesStrategySubtotal(effectiveTicketPrice(category,now),seats.length,salesStrategy)\n      : salesStrategySubtotal(effectiveTicketPrice(category,now),quantity,salesStrategy);"],
 ["      : validLink!.customPriceMinor!*quantity","      : validLink!.customPriceMinor!*(salesStrategy===\"BUY_ONE_GET_ONE\"?quantity/2:quantity)"],
 ["guestFields={parseGuestFields(event.description)}/>","guestFields={parseGuestFields(event.description)} salesStrategy={salesStrategy}/>"]
]);

patch("src/components/checkout-form.tsx",[
 ["import type { Locale } from \"@/lib/i18n\";","import type { Locale } from \"@/lib/i18n\";\nimport type { TicketSalesStrategy } from \"@/lib/ticket-sales-strategy\";"],
 ["guestFields:GuestFieldConfig};","guestFields:GuestFieldConfig;salesStrategy:TicketSalesStrategy};"],
 ["<span className=\"muted\">{text.quantity}</span><strong>{props.quantity}</strong>","<span className=\"muted\">{props.salesStrategy===\"BUY_ONE_GET_ONE\"?(locale===\"he\"?\"כרטיסים / חבילות\":locale===\"en\"?\"Tickets / bundles\":\"Билеты / комплекты\"):text.quantity}</span><strong>{props.salesStrategy===\"BUY_ONE_GET_ONE\"?`${props.quantity} / ${props.quantity/2}`:props.quantity}</strong>"]
]);

patch("src/app/api/checkout/route.ts",[
 ["import { calculateServiceFee } from \"@/lib/service-fee\";","import { calculateServiceFee } from \"@/lib/service-fee\";\nimport { parseTicketSalesStrategy, salesStrategySubtotal } from \"@/lib/ticket-sales-strategy\";"],
 ["      const quantity=table?table.seats:seats.length||input.quantity;if(!table&&!seats.length&&(quantity<category.minPerOrder||quantity>category.maxPerOrder))","      const quantity=table?table.seats:seats.length||input.quantity;const salesStrategy=parseTicketSalesStrategy(category.description);if(table&&salesStrategy===\"BUY_ONE_GET_ONE\")throw new Error(\"Стратегия 1+1 недоступна для продажи объекта целиком\");if(salesStrategy===\"BUY_ONE_GET_ONE\"&&quantity%2!==0)throw new Error(\"Для билета 1+1 нужно выбрать чётное количество билетов\");if(!table&&!seats.length&&(quantity<category.minPerOrder||quantity>category.maxPerOrder))"],
 ["const standardSubtotal=[...requested.values()].reduce((sum,item)=>sum+item.price*(table?1:item.quantity),0);","const standardSubtotal=[...requested.values()].reduce((sum,item)=>sum+(table?item.price:salesStrategySubtotal(item.price,item.quantity,parseTicketSalesStrategy(item.category.description))),0);"],
 ["promoterLink.customPriceMinor*quantity):null;","promoterLink.customPriceMinor*(salesStrategy===\"BUY_ONE_GET_ONE\"?quantity/2:quantity)):null;"],
 ["table?.category?Math.round(effectiveTicketPrice(table.category)/quantity):categoryPrice","table?.category?Math.round(effectiveTicketPrice(table.category)/quantity):salesStrategy===\"BUY_ONE_GET_ONE\"?Math.round(categoryPrice/2):categoryPrice"]
]);

console.log("Applied Atlas ticket 1+1 flow patch.");
