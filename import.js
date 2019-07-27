var express = require('express');
var path = require('path');
var mongoose = require('mongoose');
var config = require('./config/database');
var fs = require('fs');

// Connect to db
mongoose.connect(config.database, { useNewUrlParser: true });
//mongoose.connect(process.env.MONGODB_URI || 'mongodb://localhost/cmscart');
var db = mongoose.connection;
db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', function () {
    console.log('Connected to MongoDB');
});


// Init app
var app = express();



var Product = require('./models/product');

//update ware houses for products
app.get('/w/:brand', function (req, res) {
      var brand = req.params.brand; 
      Product.find({brand: {$ne: "jelly-belly"}}, function(err, products) {
        // console.log('products ', products , products.length);
        products.map(product => {
          updateProduct(product, brand, function (err, updated) {
            if(err) console.log('not updated', product.slug);
            else console.log('updated', product.slug);
          });
        });
      });
  res.send('done');
});

function updateProduct(product, brand, callback) {
  product.warehouse = brand;
  product.save(function (err, saved) {
    // console.log('err, saved ', err, saved);
    callback(err, saved)
  });
}

// app.get('/', function (req, res) {
//       var foundCounter = 0;
//       var notFoundCounter = 0;
//       const jsonFilePath=path.resolve(__dirname, 'orders/missingCodes.json');
//       var jsonObj = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
//           jsonObj.map(obj => {
//             updateCode(obj, function (err, found) {
//               console.log('==> found ', found , '\n');
//               if(found) {
//                 found.product_code = obj.ProductCode;
//                 found.save();
//                 foundCounter++;
//               } else {
//                 notFoundCounter++;
//               }
//               console.log('found ', foundCounter , ' not found ', notFoundCounter);
//             });
//           });
//         res.send('done');
// });


const createCsvWriter = require('csv-writer').createObjectCsvWriter;


app.get('/p', function (req, res) {
  var counter = 0;
  Product.find({"product_code" : " " }, function (err, product) { 

    const csvWriter = createCsvWriter({
          path: path.resolve(__dirname, 'orders/productWithoutCodes.csv'),
          header: [
              {id: 'name', title: 'Name'},
              {id: 'price', title: 'Price'},
              {id: 'brand', title: 'Brand'}
          ]
      });
       
       var records = [];
       product.map(obj => {
        records.push({name: obj.name, price: obj.price, brand: obj.brand});
       });
      csvWriter.writeRecords(records)      
          .then(() => {
              console.log('...Done');
          });
    console.log(err, product.length);
    res.send('done');
  })
});

app.get('/trim/p', function (req, res) {
  Product.find({}, function (err, product) { 
       product.map(obj => {
        if(obj.product_code && obj.product_code !=" " && obj.product_code !="") {
          obj.product_code = obj.product_code.trim();
          obj.save(console.log('save'));          
        }
       });
    res.send('done');
  })
});


function updateCode(product, callback) {
  Product.findOne({name: product.Name}, function (err, product) {
    callback(err, product);
  });
}


//import new products
app.get('/import_products', function(req, res) {
   const jsonFilePath=path.resolve(__dirname, 'orders/new-products.json');
      var jsonObj = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
      // console.log('jsonObj ', jsonObj.ADULT);
          jsonObj.ADULT.map(product => {
            // console.log('\n ==> ', product);
            //insert prodcut
            var newProduct = new Product({
              name: product.Description,
              slug: product.Description.replace(/\s+/g, '-').toLowerCase(),
              desc: product.Description,
              brand: "adult-sweets",
              category: "adult-sweets",
              price: parseFloat(product.Price),
              image: product.Code + '.png',
              instock: true,
              vat: false,
              product_code: product.Code,
              featured: false,
              warehouse: "adult-sweets",
              weight_g: '',
              weight_oz: ''
            });
            console.log('\n save it ==> ', newProduct , ' price ==> ', product.Price);
            newProduct.save();
          });

    res.send('done');
});

// var addAndRemoveImage = require("./service/addRemoveS3Image");
// var s3Bucket = bucket("sweet-product-images-new");

app.get('/upload_images', function(req, res) {
  // var productImage = req.files.image;
  // var imageFile = 
  // addAndRemoveImage(s3Bucket, "add", imageFile, productImage);
});

//update ware houses for products
app.get('/stock/true', function (req, res) {
      // const jsonFilePath=path.resolve(__dirname, 'orders/Bizzcandy-Stock/BizzcandyOrderForm11thJuly2019.json');
      // var jsonObj = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
      // console.log('jsonObj ', jsonObj);
      Product.update({brand: "adult-sweets"}, { $set:{ "instock" : true } }, { multi : true } ).exec(function() {
        console.log('all updated');
      });
      // var foundCounter = 0;
      //     jsonObj.map(product => {
      //       // console.log('\n ==> ', product.CODE);
      //       // Product.findOne({product_code: product.CODE}, function (err, found) {
      //       Product.update({product_code: product.CODE}, {$set:{ "instock" : true }}, function (err, found) {
      //         if(found && found != null) {
      //           foundCounter++;
      //           console.log('found for ', found.product_code);
      //           console.log('foundCounter ', foundCounter);
      //         }
      //       });
      //     });

    res.send('done');
});

var productsToLink = [
"71876",
"71943",
"73543",
"73515",
"72609",
"73541",
"71562",
"71952",
"73547",
"73413",
"72020",
"590039",
"73512",
"73513",
"73510",
"73511",
"75510",
"996153",
"987168",
"987984",
"642669",
"642662",
"642661",
"642645",
"642667",
"642664",
"642671",
"642648",
"642672",
"642660",
"642582",
"642649",
"642663",
"642666",
"177647",
];


app.get('/linkwithwh', function (req, res) {
    // Product.find({product_code: {$in:productsToLink}}).exec(function(err, prds) {
      Product.update({product_code: {$in:productsToLink}}, { $set:{"category": "", "brand": "american-soda", "warehouse": "american-candy"}}, { multi : true } ).exec(function(err,done) {
        console.log('all updated ', err, done);
      });

    res.send('done');
});
// Start the server
const port = process.env.PORT || 9000;
app.listen(port, function () {
    console.log(`Server started on port ${port}`);
});

String.prototype.toLowerCase = function(){
  return this.split('').map(function(c){
     var cc = c.charCodeAt(0);
     if (cc > 64 && cc < 91) {
        return String.fromCharCode(cc + 32);
     }
     return c;
  }).join('');
}