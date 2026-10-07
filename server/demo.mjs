export function createDemoCase() {
  return structuredClone(DEMO_CASE);
}

const noticeSource = {
  name: 'recall-notice.txt',
  text: 'SYNTHETIC RECALL DRILL — Cedar Valley Foods recalls Sesame Oat Bar 40 g, SKU CV-SES-40, UPC 00012345678905, lots CV-260801-01, CV-260801-02, and CV-260801-03 due to undeclared peanut. Hold affected product and contact the supplier.',
};

const inventorySource = (row, text) => ({ name: 'synthetic receiving.csv', text, row });
const shipmentSource = (row, text) => ({ name: 'synthetic shipments.csv', text, row });

const DEMO_CASE = {
  id: 'RR-2026-014',
  title: 'Sesame oat bars',
  organization: 'Northline Distribution',
  mode: 'sample',
  notice: {
    product: 'Sesame Oat Bar 40 g',
    brand: 'Cedar Valley Foods',
    sku: 'CV-SES-40',
    upc: '00012345678905',
    lotCodes: ['CV-260801-01', 'CV-260801-02', 'CV-260801-03'],
    reason: 'Undeclared peanut',
    date: '2026-09-03',
    instructions: 'Hold affected product and contact the supplier',
    source: noticeSource,
    confirmed: true,
  },
  records: [
    { id: 'INV-101', product: 'Sesame Oat Bar 40 g', brand: 'Cedar Valley Foods', sku: 'CV-SES-40', upc: '00012345678905', lot: 'CV-260801-01', quantity: 24, unit: 'cartons', location: 'Chicago / A-12', source: inventorySource(2, 'INV-101,Sesame Oat Bar 40 g,Cedar Valley Foods,CV-SES-40,00012345678905,CV-260801-01,24,cartons,Chicago / A-12') },
    { id: 'INV-102', product: 'Sesame Oat Bar 40 g', brand: 'Cedar Valley Foods', sku: 'CV-SES-40', upc: '00012345678905', lot: 'CV-260801-02', quantity: 18, unit: 'cartons', location: 'Chicago / A-14', source: inventorySource(3, 'INV-102,Sesame Oat Bar 40 g,Cedar Valley Foods,CV-SES-40,00012345678905,CV-260801-02,18,cartons,Chicago / A-14') },
    { id: 'INV-103', product: 'Sesame Oat Bar 40 g', brand: 'Cedar Valley Foods', sku: 'CV-SES-40', upc: '00012345678905', lot: '', quantity: 12, unit: 'cartons', location: 'Madison / B-03', source: inventorySource(4, 'INV-103,Sesame Oat Bar 40 g,Cedar Valley Foods,CV-SES-40,00012345678905,,12,cartons,Madison / B-03') },
    { id: 'INV-104', product: 'Sesame Oat Bar 40 g', brand: 'Cedar Valley Foods', sku: 'CV-SES-40', upc: '00012345678905', lot: 'CV-260801-04', quantity: 30, unit: 'cartons', location: 'Chicago / A-16', source: inventorySource(5, 'INV-104,Sesame Oat Bar 40 g,Cedar Valley Foods,CV-SES-40,00012345678905,CV-260801-04,30,cartons,Chicago / A-16') },
    { id: 'INV-105', product: 'Cocoa Oat Bar 40 g', brand: 'Cedar Valley Foods', sku: 'CV-COC-40', upc: '00012345678912', lot: 'CV-260801-01', quantity: 20, unit: 'cartons', location: 'Madison / B-04', source: inventorySource(6, 'INV-105,Cocoa Oat Bar 40 g,Cedar Valley Foods,CV-COC-40,00012345678912,CV-260801-01,20,cartons,Madison / B-04') },
    { id: 'INV-106', product: 'Sesame Oat Bar 40 g', brand: 'Cedar Valley Foods', sku: 'CV-SES-40', upc: '00012345678905', lot: 'CV-260801-03', quantity: 0, unit: 'cartons', location: 'Chicago / Dispatch', source: inventorySource(7, 'INV-106,Sesame Oat Bar 40 g,Cedar Valley Foods,CV-SES-40,00012345678905,CV-260801-03,0,cartons,Chicago / Dispatch') },
  ],
  shipments: [
    { id: 'SH-701', recordId: 'INV-101', customer: 'Lakeview Market', quantity: 16, source: shipmentSource(2, 'SH-701,INV-101,Lakeview Market,16') },
    { id: 'SH-702', recordId: 'INV-102', customer: 'Juniper Grocery', quantity: 12, source: shipmentSource(3, 'SH-702,INV-102,Juniper Grocery,12') },
    { id: 'SH-703', recordId: 'INV-106', customer: 'Lakeview Market', quantity: 8, source: shipmentSource(4, 'SH-703,INV-106,Lakeview Market,8') },
    { id: 'SH-704', recordId: 'INV-106', customer: 'Harbor Pantry', quantity: 16, source: shipmentSource(5, 'SH-704,INV-106,Harbor Pantry,16') },
    { id: 'SH-705', recordId: 'INV-103', customer: 'Birch Corner Store', quantity: 8, source: shipmentSource(6, 'SH-705,INV-103,Birch Corner Store,8') },
    { id: 'SH-706', recordId: 'INV-104', customer: 'Harbor Pantry', quantity: 10, source: shipmentSource(7, 'SH-706,INV-104,Harbor Pantry,10') },
  ],
  resolutions: {},
  actions: {},
  activity: [
    { id: 'ACT-1', text: 'Synthetic recall drill opened', at: '2026-09-03T15:00:00.000Z' },
  ],
};
