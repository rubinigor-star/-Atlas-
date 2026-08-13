"use client";

export function FinanceReportActions({eventId}:{eventId:string}){
  return <div className="row" style={{flexWrap:"wrap"}}>
    <a className="btn secondary" href={`/api/finance/events/${eventId}/report.csv`}>Скачать CSV</a>
    <button className="btn secondary" type="button" onClick={()=>window.print()}>Печать / PDF</button>
  </div>;
}
