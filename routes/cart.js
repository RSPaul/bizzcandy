const express = require("express");
const router = express.Router();
const paths = require("../config/paths");
const keys = require("../config/keys");
const aws = require("aws-sdk");
const emailParams = require("../service/email");
const uniqid = require("uniqid");
const applyDiscount = require("../service/applyDiscount");
const Product = require("../models/product");
const Order = require("../models/order");
var nodemailer = require('nodemailer');
var email = require('../config/email');
var auth = require('../config/auth');
var isUser = auth.isUser;

/*
 * GET add product to cart
 */
router.get("/add/:product", function(req, res) {
  const slug = req.params.product;
  Product.findOne({ slug: slug }, function(err, p) {
    if (err) console.log(err);
    if (res.locals.user != null) {
      applyDiscount(res.locals.user.discount_code, p);
    }
    // const firstWarehouse = (req.session.cart && req.session.cart.length) ? req.session.cart[0].warehouse : "";
    if (typeof req.session.cart == "undefined") {
      req.session.cart = [];
      req.session.cart.push({
        title: slug,
        qty: 1,
        price: parseFloat(p.price).toFixed(2),
        image: paths.s3ImageUrl + "/" + p.image,
        vat: p.vat,
        product_code: p.product_code,
        warehouse: p.warehouse
      });
      req.flash("success", "Product added!");
      res.redirect("back");
    } else {
      var cart = req.session.cart;
      var newItem = true;

      for (var i = 0; i < cart.length; i++) {
        if (cart[i].title == slug) {
          cart[i].qty++;
          newItem = false;
          break;
        }
      }

      if (newItem) {
        //check user is trying to purchase product from other ware house
        // var allowUpdate = true;
        // cart.map(product => {
        //   if(firstWarehouse === p.warehouse) {
        //     allowUpdate = true;
        //   } else {
        //     allowUpdate = false;
        //   }
        // });
        // if(allowUpdate) {          
          cart.push({
            title: slug,
            qty: 1,
            price: parseFloat(p.price).toFixed(2),
            image: paths.s3ImageUrl + "/" + p.image,
            vat: p.vat,
            product_code: p.product_code,
            warehouse: p.warehouse
          });
          req.flash("success", "Product added!");
          res.redirect("back");
        // } else {
        //   req.flash("danger", "You can not purcahse product from different warehouses!");
        //   res.redirect("back");
        // }
      }
    }

    //console.log(req.session.cart);
  });
});

/*
 * GET checkout page
 */

router.get("/checkout", function(req, res) {
  if (req.session.cart && req.session.cart.length == 0) {
    delete req.session.cart;
    res.redirect("/cart/checkout");
  } else {
    res.render("checkout", {
      title: "Checkout",
      cart: req.session.cart
    });
  }
});

/*
 * GET update product
 */
router.get("/update/:product", function(req, res) {
  var slug = req.params.product;
  var cart = req.session.cart;
  var action = req.query.action;
  var quantity = req.query.qty;

  for (var i = 0; i < cart.length; i++) {
    if (cart[i].title == slug) {
      switch (action) {
        case "clear":
          cart.splice(i, 1);
          if (cart.length == 0) delete req.session.cart;
          break;
        case "update":
          cart[i].qty = quantity;
          break;
        default:
          console.log("update problem");
          break;
      }
      break;
    }
  }

  //req.flash('success', 'Cart updated!');
  res.redirect("/cart/checkout");
});

/*
 * GET clear cart
 */

router.get("/clear", function(req, res) {
  delete req.session.cart;

  req.flash("success", "Cart cleared!");
  res.redirect("/cart/checkout");
});

/*
 * GET buy now
 */

router.get("/buynow", isUser, function(req, res) {
  //console.log('req.session.cart', req.session.cart);
  // aws.config.accessKeyId = keys.accessKeyId;
  // aws.config.secretAccessKey = keys.secretAccessKey;
  
  var cartDetails = req.session.cart;
  var user = res.locals.user;
  var orderNo = uniqid.time();
  // var cartError = false;
  // var cartPrice = 0;
  // //check if jelly-belly order, can't be less than 300
  // if(cartDetails && cartDetails[0] && cartDetails[0].warehouse === 'jelly-belly') {
  //   cartDetails.map(product => {
  //     cartPrice = parseFloat(parseFloat(cartPrice) + parseFloat(product.price * product.qty)).toFixed(2);
  //   });
  //   if(cartPrice < 300) {
  //     cartError = true;
  //   }
  // }
  
  // if(!cartError) {
    // var warehouseInitial = '';
    // if(cartDetails[0].warehouse === 'jelly-belly') warehouseInitial = 'JB-';
    // else if(cartDetails[0].warehouse === 'american-candy') warehouseInitial = 'AC-';
    // else if(cartDetails[0].warehouse === 'adult-sweets') warehouseInitial = 'AS-';
    // else if(cartDetails[0].warehouse === 'ausnewzealand') warehouseInitial = 'AN-';
    // orderNo = warehouseInitial + orderNo.toUpperCase();
    orderNo = orderNo.toUpperCase();
    var order = new Order({
      orderNo,
      user,
      items: cartDetails
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
    cartDetails.forEach(product => {
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

    delete req.session.cart;
    order.save();

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
    };

    try {
      smtpTransport.sendMail(mailOptions, function(err) {
          console.log(err);
      });
    } catch (error) {
      res.status(422).send("Something failed: " + error);
    }

    res.redirect("/cart/order");
  // } else {
  //   req.flash("danger", "Jelly Belly products order should be more than £300.");
  //   res.redirect("/cart/checkout");
  // }
});

/*
 *   Order confirmation
 */

router.get("/order", (req, res) => {
  res.render("order", {
    title: "Order Confirmation"
  });
});

// Exports
module.exports = router;
