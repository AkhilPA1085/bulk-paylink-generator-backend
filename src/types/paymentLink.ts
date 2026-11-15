export type PaymentLinkCsvRow = {
  customerName: string;
  customerEmail: string;
  amount: string;
  currency: string;
};

export type PaylinkJobData ={
  bulkJobId:string;
  filePath:string
}

export type PaymentLinkBatchRow = PaymentLinkCsvRow & {
  rowNumber: number;
};


export type FailePaylinkRow ={
  rowNumber:number;
  rowData:PaymentLinkCsvRow;
  errorMessage:string;
}