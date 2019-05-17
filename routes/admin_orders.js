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

const Order = require("../models/order");
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
    res.render("admin/order_items", {
      order
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

    const item = order.items.id(req.params.itemId);
    res.render("admin/edit_order_item", {
      order,
      item
    });
  });
});

router.post("/edit/:orderId/item/:itemId", isAdmin, (req, res) => {
  const { price, qty, vat } = req.body;

  Order.findById(req.params.orderId, (err, order) => {
    if (err) console.log(err);

    const item = order.items.id(req.params.itemId);
    item.price = price;
    item.qty = qty;
    item.vat = vat == "on" ? true : false;

    order.save();

    req.flash("success", "order item updated!");
    res.redirect("/admin/orders/" + req.params.orderId);
  });
});

router.get("/delete/:orderId/item/:itemId", isAdmin, (req, res) => {
  Order.findById(req.params.orderId, (err, order) => {
    if (err) console.log(err);

    const item = order.items.id(req.params.itemId);
    item.remove();
    order.save();

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
            _id: new ObjectID()
          });
        }
        counter++;
        if(orderItems.length == counter) {
          var orderNo = uniqid.time();
          var order = new Order({
            orderNo: orderNo,
            user: res.locals.user,
            items: orderArray
          });

          var total = 0;
          var subTotal = 0;
          var vatTotalAmt = 0;
          var emailBody = `<!DOCTYPE html><html><head><title>Bizza Candy - order confirmation</title></head><body<img src="https://bizzcandy.com/images/logo.png"><p>Dear ${
            res.locals.user.name
          }, <br/><br/>We have recived your order. Your Order Number is: <b>${orderNo.toUpperCase()}</b></p>Regards,<br><a href="bizzcandy.com">Bizzcandy</a></body></html>`;
          //send email
          var smtpTransport = nodemailer.createTransport({
           service: email.SMTP_SERVICE,
           auth: {
                  user: email.SMTP_USER,
                  pass: email.SMTP_PASS
              }
          });
          var mailOptions = {
              to: res.locals.user.email,
              from: 'Bizzcandy Support<support@bizzcandy.com>',
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
  });
});

function getProductByCode(productCode, callback) {
  Product.findOne({product_code: productCode}, function (err, product) {
    callback(err, product);
  });
}

module.exports = router;
