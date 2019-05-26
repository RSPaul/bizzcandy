const express = require("express");
const ObjectID = require('mongodb').ObjectID;
const router = express.Router();
const auth = require("../config/auth");
const isAdmin = auth.isAdmin;
const csvtojson = require('csvtojson');
const uniqid = require("uniqid");
const paths = require("../config/paths");
var nodemailer = require('nodemailer');
var email = require('../config/email');
const emailParams = require("../service/email");

const Order = require("../models/order");
const Invoice = require("../models/invoice");
const User = require("../models/user");
const Product = require("../models/product");

router.get("/", isAdmin, (req, res) => {
  Order.find((err, orders) => {
    res.render("admin/orders", {
      orders,
      count: orders.length
    });
  })
    .populate("user", "name email")
    .sort({"date": -1});
});

router.get("/:id", isAdmin, (req, res) => {
  Order.findById(req.params.id, (err, order) => {
    if (err) console.log(err);              
    //check if invoice listing exists, redirect to manage invoices page
      Invoice.find({orderNo: order.orderNo})
        .exec((err, invoices) => {
          if (err) console.log(err);
            if(invoices.length) {
              res.render("admin/invoices_list", {
                invoices,
                order
              });
            } else {
              res.render("admin/order_items", {
                order,
                back: false,
                orderDetails: order
              });
            }
      });
  }).populate("user", "name");
});

router.get("/user/:id", isAdmin, (req, res) => {
  Order.find({ user: { _id: req.params.id } }, (err, orders) => {
    if (err) console.log(err);
    res.render("admin/orders", {
      orders,
      count: orders.length
    });
  });
});

router.get("/delete/:id", isAdmin, (req, res) => {
  Order.findByIdAndDelete(req.params.id, err => {
    if (err) console.log(err);

    req.flash("success", "order deleted!");
    res.redirect("/admin/orders/");
  });
});

router.get("/edit/:orderId/item/:itemId", isAdmin, (req, res) => {
  Order.findById(req.params.orderId, (err, order) => {
    if (err) console.log(err);

    if(order && order.items && order.items.length) {
        console.log('render from here ', order);
        const item = order.items.id(req.params.itemId);
        res.render("admin/edit_order_item", {
          order,
          item,
          orderDetails: order
        });
    } else {
      Invoice.findOne({orderNo: order.orderNo}, (err, order2) => {
        const item = order2.items.id(req.params.itemId);
        res.render("admin/edit_order_item", {
          order:order2,
          item,
          orderDetails: order
        });
      });       
    }
  });
});

router.post("/edit/:orderId/item/:itemId", isAdmin, (req, res) => {
  const { price, qty, vat } = req.body;

  Order.findById(req.params.orderId, (err, order) => {
    console.log('order is ', order);
    if (err) console.log(err);
    //check if it is invoice
    if(order && order.items && order.items.length) {
      const item = order.items.id(req.params.itemId);
      item.price = price;
      item.qty = qty;
      item.vat = vat == "on" ? true : false;
      order.save();      
    } else {
      Invoice.findOne({orderNo: order.orderNo}, (err, order) => {
        const item = order.items.id(req.params.itemId);
        item.price = price;
        item.qty = qty;
        item.vat = vat == "on" ? true : false;
        order.save();
      });
    }

    req.flash("success", "order item updated!");
    res.redirect("/admin/orders/" + req.params.orderId);
  });
});

router.get("/delete/:orderId/item/:itemId", isAdmin, (req, res) => {
  Order.findById(req.params.orderId, (err, order) => {
    if (err) console.log(err);
    if(order && order.items && order.items.length) {      
      const item = order.items.id(req.params.itemId);
      item.remove();
      order.save();
    } else {
      //remove from invoice colllection
      Invoice.findOne({orderNo: order.orderNo}, (err, order) => {
        const item = order.items.id(req.params.itemId);
        item.remove();
        order.save();
      });
    }

    req.flash("success", "Item deleted");
    res.redirect("/admin/orders/" + req.params.orderId);
  });
});

router.get("/invoice/:orderId", isAdmin, (req, res) => {
  let subTotal = 0;
  let vat = 0;
  Order.findById(req.params.orderId)
    .populate("user")
    .exec((err, order) => {
      if (err) console.log(err);
      order.items.map(item => {
        subTotal += item.qty * item.price;
      });
      vat = subTotal * 0.2;
      res.render("admin/invoice", {
        order,
        subTotal,
        vat,
        total: vat + subTotal
      });
    });
});

router.get("/add/order", isAdmin, (req, res) => {
  User.find({}, (err, users) => {
    if (err) console.log(err);
      res.render("admin/add_order", {
        users
      });
  });
});

router.post("/add/order", isAdmin, (req, res) => {
  let counter = 0;
  csvData = req.files.file.data.toString('utf8');
  csvtojson().fromString(csvData).then(orderItems => {
    var orderArray = [];
    //get user first
    getUserById(req.body.user, function(err, user) {
      if(user) {        
        orderItems.map(orderItem => {
          getProductByCode(orderItem.ProductCode, function(err, product) {
            if(!product) { 
              console.log('Product not found for ', orderItem.ProductCode);
            } else {
              orderArray.push({
                title: product.slug,
                qty: orderItem.Quantity,
                price: parseFloat(product.price).toFixed(2),
                image: paths.s3ImageUrl + "/" + product.image,
                vat: product.vat,
                product_code: orderItem.ProductCode,
                warehouse: product.warehouse,
                _id: new ObjectID()
              });
            }
            counter++;
            if(orderItems.length == counter) {
              // var warehouseInitial = '';
              // if(orderArray[0].warehouse === 'jelly-belly') warehouseInitial = 'JB-';
              // else if(orderArray[0].warehouse === 'american-candy') warehouseInitial = 'AC-';
              // else if(orderArray[0].warehouse === 'adult-sweets') warehouseInitial = 'AS-';
              // else if(orderArray[0].warehouse === 'ausnewzealand') warehouseInitial = 'AN-';
              var orderNo = uniqid.time();
              // orderNo = warehouseInitial + orderNo.toUpperCase();
              orderNo = orderNo.toUpperCase();
              var order = new Order({
                orderNo: orderNo,
                user: user,
                items: orderArray
              });

              var total = 0;
              var subTotal = 0;
              var emailBody = `<!DOCTYPE html><html><head><title>Bizza Candy - order confirmation</title></head><body<img src="https://bizzcandy.com/images/logo.png"><p>Dear ${
                user.name
              }, <br/><br/>Order Number: ${orderNo.toUpperCase()}<br/><br/>Your below order has been received and we will contact you for payment details.</p><table style="background-color: transparent; width: 100%; max-width: 100%; margin-bottom: 20px; order-spacing: 0; border-collapse: collapse;">
                <tr style="padding:8px;line-height:1.42857143;vertical-align:top;border-top: 1px solid #ddd; background-color: #f9f9f9;">
                  <th style="background-color: #f9f9f9;text-align: left; padding:8px;line-height:1.42857143;vertical-align:top;border-top: 1px solid #ddd;">Name</th>
                  <th>Price</th>
                  <th>Quantity</th>
                  <th>Discount</th>
                  <th>Sub Total</th>
                  </tr>`;
              var  subTotalAmtAll = 0;
              var  vatTotalAmt = 0;
              var  productBrand = '';
              var  discountName = '';
              orderArray.forEach(product => {
                subTotal = parseFloat(product.qty * product.price).toFixed(2);
                emailBody += `<tr style="text-align: center;padding:8px;line-height:1.42857143;vertical-align:top;border-top: 1px solid #ddd; background-color: #f9f9f9;"><td style="background-color: #f9f9f9;text-align: left; padding:8px;line-height:1.42857143;vertical-align:top;border-top: 1px solid #ddd;">${
                  product.title
                }</td><td>£${product.price}</td><td>${
                  product.qty
                }</td>`;

                if(res.locals.user && res.locals.user.discount_code && res.locals.user.discount_code[0]) { 
                  var discount = res.locals.user.discount_code[0].split("-")[1]; 
                  discountName = res.locals.user.discount_code[0].split("-")[0]; 
                  productBrand = product.title.split("-")[0]  
                    if(productBrand.toLowerCase() == discountName.toLowerCase()) {  
                    emailBody += `<td>${discount}</td>`;
                     } else {
                      emailBody += `<td>NA</td>`;
                     }
                 } else {
                  emailBody += `<td>NA</td>`;
                 } 
                
                if(productBrand && discountName && productBrand != '' && productBrand.toLowerCase() == discountName.toLowerCase()) { 
                  var subTotalAmt = parseFloat(product.qty * product.price).toFixed(2);
                  var discountAmt = parseFloat((subTotalAmt/100) * discount).toFixed(2);
                  subTotalAmt = parseFloat(subTotalAmt - discountAmt).toFixed(2) ;
                  subTotalAmtAll = parseFloat(parseFloat(subTotalAmtAll) + parseFloat(subTotalAmt)); 
                } else {
                  var subTotalAmt = parseFloat(product.qty * product.price).toFixed(2);
                  subTotalAmtAll = parseFloat(parseFloat(subTotalAmtAll) + parseFloat(subTotalAmt));
                } 
                emailBody +=`<td>£${subTotalAmt}</td>`;
                if(product.vat){ 
                   var totalAmount = subTotalAmt;
                   var vatAmt = parseFloat((totalAmount/100) * 20).toFixed(2);
                   vatTotalAmt = parseFloat(parseFloat(vatTotalAmt) + parseFloat(vatAmt));
                } 
              });

              emailBody += `<tr style="text-align: center;padding:8px;line-height:1.42857143;vertical-align:top;border-top: 1px solid #ddd; background-color: #f9f9f9;"><td style="background-color: #f9f9f9;text-align: left; padding:8px;line-height:1.42857143;vertical-align:top;border-top: 1px solid #ddd;">&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td><b>Subtotal:</b></td><td><b>£${parseFloat(subTotalAmtAll).toFixed(2)}`;

              emailBody += `<tr style="text-align: center;padding:8px;line-height:1.42857143;vertical-align:top;border-top: 1px solid #ddd; background-color: #f9f9f9;"><td style="background-color: #f9f9f9;text-align: left; padding:8px;line-height:1.42857143;vertical-align:top;border-top: 1px solid #ddd;">&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td><b>VAT:</b></td><td><b>£${parseFloat(vatTotalAmt).toFixed(2)}`;

              emailBody += `<tr style="text-align: center;padding:8px;line-height:1.42857143;vertical-align:top;border-top: 1px solid #ddd; background-color: #f9f9f9;"><td style="background-color: #f9f9f9;text-align: left; padding:8px;line-height:1.42857143;vertical-align:top;border-top: 1px solid #ddd;">&nbsp;</td><td>&nbsp;</td><td>&nbsp;</td><td><b>Total:</b></td><td><b>£${parseFloat(parseFloat(subTotalAmtAll) + parseFloat(vatTotalAmt)).toFixed(2)}`;
              emailBody += `</b></td></tr></table><p><b><i>All prices exclude tax and tax will be added to the total.</i></b></p><br/><br/> Regards,<br>bizzacandy.com</body></html>`;
              //send email
              var smtpTransport = nodemailer.createTransport({
               service: email.SMTP_SERVICE,
               auth: {
                      user: email.SMTP_USER,
                      pass: email.SMTP_PASS
                  }
              });
              var mailOptions = {
                  to: user.email,
                  bcc: emailParams.carbonCopy,
                  from: emailParams.fromAddress,
                  subject: 'Thank you for your order',
                  html: emailBody
              }
              smtpTransport.sendMail(mailOptions, function(err) {
                  console.log(err);              
              });
              req.flash('success', 'Order is created!');
              order.save(res.redirect('/admin/orders'));          
            }
          });
        });
      } else {
        req.flash('danger', 'Selected user not found!');
        res.redirect('/admin/orders/add/order'); 
      }
    });
  });
});

router.get("/invoice_items/:invoiceId", isAdmin, (req, res) => {
    Invoice.findById(req.params.invoiceId, (err, invoice) => {
        if (err) console.log(err);
          //send along order details
          Order.findOne({orderNo: invoice.orderNo}, (err, orderDetails) => {
              res.render("admin/order_items", {
                order: invoice,
                back: true,
                orderDetails: orderDetails
              });
          });
    }).populate("user", "name");
});

router.get("/single_invoice/:invoiceId", isAdmin, (req, res) => {
    let subTotal = 0;
    let vat = 0;
    Invoice.findById(req.params.invoiceId)
      .populate("user")
      .exec((err, order) => {
        if (err) console.log(err);
        order.items.map(item => {
          subTotal += item.qty * item.price;
        });
        vat = subTotal * 0.2;
        res.render("admin/invoice", {
          order,
          subTotal,
          vat,
          total: vat + subTotal
        });
      });
});

function getProductByCode(productCode, callback) {
  Product.findOne({product_code: productCode}, function (err, product) {
    callback(err, product);
  });
}

function getUserById(userId, callback) {
  User.findOne({_id: userId}, function (err, user) {
    callback(err, user);
  });
}

module.exports = router;
