const mongoose = require('mongoose');
const InvoiceModel = mongoose.model('Invoice');
const QuoteModel = mongoose.model('Quote');
const { calculate } = require('@/helpers');
const { increaseBySettingKey } = require('@/middlewares/settings');

const convertQuoteToInvoice = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Cari quote berdasarkan ID
    const quote = await QuoteModel.findById(id);
    if (!quote) {
      return res.status(404).json({
        success: false,
        result: null,
        message: 'Quote not found',
      });
    }

    // Extract data dari quote
    const { items = [], taxRate = 0, discount = 0 } = quote;
    let subTotal = 0;
    let taxTotal = 0;
    let total = 0;

    // Hitung total dari item
    items.forEach((item) => {
      let itemTotal = calculate.multiply(item['quantity'], item['price']);
      subTotal = calculate.add(subTotal, itemTotal);
      item['total'] = itemTotal;
    });
    
    taxTotal = calculate.multiply(subTotal, taxRate / 100);
    total = calculate.add(subTotal, taxTotal);

    let paymentStatus = calculate.sub(total, discount) === 0 ? 'paid' : 'unpaid';

    // Buat invoice baru berdasarkan quote
    const invoiceData = {
      ...quote.toObject(),
      subTotal,
      taxTotal,
      total,
      items,
      paymentStatus,
      createdBy: req.admin._id,
      quoteId: quote._id, // Simpan referensi ke quote
    };

    const newInvoice = await new InvoiceModel(invoiceData).save();
    const fileId = `invoice-${newInvoice._id}.pdf`;
    
    const updateInvoice = await InvoiceModel.findByIdAndUpdate(
      newInvoice._id,
      { pdf: fileId },
      { new: true }
    );

    // Tingkatkan nomor invoice terakhir
    increaseBySettingKey({ settingKey: 'last_invoice_number' });

    return res.status(200).json({
      success: true,
      result: updateInvoice,
      message: 'Quote successfully converted to Invoice',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      result: null,
      message: error.message,
    });
  }
};

module.exports = convertQuoteToInvoice;
