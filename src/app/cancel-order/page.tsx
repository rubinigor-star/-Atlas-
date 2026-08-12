import { CancellationCustomerForm } from "@/components/cancellation-customer-form";

export default async function CancelOrderPage({searchParams}:{searchParams?:Promise<{order?:string;email?:string}>}){
  const query=searchParams?await searchParams:{};
  return <main style={{padding:"48px 20px 72px"}}><CancellationCustomerForm initialOrderId={query.order||""} initialEmail={query.email||""}/></main>;
}
