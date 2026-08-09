import { Order, OrderItem } from '../types';

export const parsePdfVoucher = async (fileName: string, pdfTextContent?: string): Promise<Order> => {
  const orderId = `ord_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const nowIso = new Date().toISOString();
  const cleanOrderNumber = fileName.replace(/\.[^/.]+$/, '').replace(/[^0-9]/g, '') || `ORD-${Date.now()}`;

  const items: OrderItem[] = [];

  // Si se proporciona un texto extraído del PDF
  if (pdfTextContent && pdfTextContent.trim().length > 0) {
    const orderNumberMatch = pdfTextContent.match(/(?:DETALLE DE VENTA|Order|Pedido|Factura|Comprobante|Remito|N°)\s*:?\s*#?([0-9]{4,12})/i);
    const orderNumber = orderNumberMatch ? orderNumberMatch[1] : cleanOrderNumber;

    const clientMatch = pdfTextContent.match(/(?:Razón Social|Razon Social|Client|Cliente|Señor\(es\)|Destinatario)\s*:?\s*\(?([A-Za-z0-9\s\.\-S\.R\.L\.\,S\.A\.]+)\)?/i);
    const clientName = clientMatch ? clientMatch[1].trim().split('\n')[0].trim().replace(/\)$/, '') : 'CLIENTE DEPOSITO';

    const dateMatch = pdfTextContent.match(/(?:Fecha|Emisión|Fecha Emision):\s*(\d{2}\/\d{2}\/\d{4})/i);
    const issueDate = dateMatch ? dateMatch[1] : new Date().toLocaleDateString('es-AR');

    // Parsear líneas de productos con Regex EAN-13 o SKU (3 a 14 dígitos)
    const lines = pdfTextContent.split(/[\r\n]+/).map(l => l.trim()).filter(Boolean);

    lines.forEach((line, index) => {
      const rowMatch = line.match(/^(\d{3,14})\s+(.+?)\s+(\d+)\s+\$?\s*([\d\.\,]+)/) ||
                       line.match(/^(.+?)\s+(\d{3,14})\s+(\d+)\s+\$?\s*([\d\.\,]+)/);
      if (rowMatch) {
        const code = rowMatch[1].match(/^\d+$/) ? rowMatch[1] : rowMatch[2];
        const description = (rowMatch[1].match(/^\d+$/) ? rowMatch[2] : rowMatch[1]).trim();
        const quantityRequired = parseInt(rowMatch[3], 10) || 1;
        const unitPriceStr = rowMatch[4] ? rowMatch[4].replace(/\./g, '').replace(',', '.') : '0';
        const unitPrice = parseFloat(unitPriceStr) || 0;

        items.push({
          id: `item_${orderId}_${index}`,
          orderId,
          code,
          description,
          quantityRequired,
          quantityScanned: 0,
          unitPrice,
          status: 'PENDING'
        });
      }
    });

    const totalReq = items.reduce((acc, it) => acc + it.quantityRequired, 0);

    return {
      id: orderId,
      orderNumber,
      clientName,
      issueDate,
      pdfFileName: fileName,
      status: 'PARSED',
      createdAt: nowIso,
      totalItemsRequired: totalReq,
      totalItemsScanned: 0,
      items
    };
  }

  // Devolución dinámica básica si no hay texto pasado
  return {
    id: orderId,
    orderNumber: cleanOrderNumber,
    clientName: 'CLIENTE REGISTRADO',
    issueDate: new Date().toLocaleDateString('es-AR'),
    pdfFileName: fileName,
    status: 'PARSED',
    createdAt: nowIso,
    totalItemsRequired: 0,
    totalItemsScanned: 0,
    items: []
  };
};
