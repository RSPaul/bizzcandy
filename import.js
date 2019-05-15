var express = require('express');
var path = require('path');
var mongoose = require('mongoose');
var config = require('./config/database');
var fs = require('fs');
// var bodyParser = require('body-parser');
// var session = require('express-session');
// var fileUpload = require('express-fileupload');
// var passport = require('passport');


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

// View engine setup
// app.set('views', path.join(__dirname, 'views'));
// app.set('view engine', 'ejs');

// Set public folder
// app.use(express.static(path.join(__dirname, 'public')));

// Set global errors variable
// app.locals.errors = null;

// Get Page Model
// var Page = require('./models/page');

// Get all pages to pass to header.ejs
// Page.find({}).sort({sorting: 1}).exec(function (err, pages) {
//     if (err) {
//         console.log(err);
//     } else {
//         app.locals.pages = pages;
//     }
// });

// // Get Brand Model
// var Brand = require('./models/brand');

// // Get all brands to pass to header.ejs
// Brand.find(function (err, brands) {
//     if (err) {
//         console.log(err);
//     } else {
//         app.locals.brands = brands;
//     }
// });

// // Get Category model;
// var Category = require('./models/category');





// // Express fileUpload middleware
// app.use(fileUpload());

// // Body parser middleware
// // parse application/x-www-form-urlencoded
// app.use(bodyParser.urlencoded({ extended: false }));
// // parse application/json
// app.use(bodyParser.json());

// Express session middleware
// app.use(session({
//   secret: 'keyboard cat',
//   resave: true,
//   saveUninitialized: true,
//   //cookie: { secure: true }
// }));

// require('./middleware/validator')(app);

// // Express Messages Middleware
// app.use(require('connect-flash')());
// app.use(function (req, res, next) {
//   res.locals.messages = require('express-messages')(req, res);
//   next();
// });

// Passport Config
// require('./config/passport')(passport);
// Passport Middleware
// app.use(passport.initialize());
// app.use(passport.session());

// app.get('*', function(req,res,next) {
//    res.locals.cart = req.session.cart;
//    res.locals.user = req.user || null;
//    next();
// });

// app.post('*', function(req,res,next) {
//    res.locals.cart = req.session.cart;
//    res.locals.user = req.user || null;
//    next();
// });

// require('./startup/routes')(app);

var Product = require('./models/product');

//update ware houses for products
app.get('/w', function (req, res) {
      Product.find({brand: "jelly-belly"}, function(err, products) {
        console.log('products ', products , products.length);
        products.map(product => {
          updateProduct(product, function (err, updated) {
            if(err) console.log('not updated', product.slug);
            else console.log('updated', product.slug);
          });
        });
      });
  res.send('done');
});

function updateProduct(product, callback) {
  product.warehouse = 'jelly-belly';
  product.save(function (err, saved) {
    console.log('err, saved ', err, saved);
    callback(err, saved)
  });
}

app.get('/', function (req, res) {
      const readXlsxFile = require('read-excel-file/node');
      var foundCounter = 0;
      var notFoundCounter = 0;
      const jsonFilePath=path.resolve(__dirname, 'orders/productCodes.json');
      var jsonObj = JSON.parse(fs.readFileSync(jsonFilePath, 'utf8'));
          jsonObj.map(obj => {
            getProduct(obj.column0, function (err, found) {
              console.log('==> found ', found , '\n');
              if(found) {
                // console.log('found ', found);
                foundCounter++;
              } else {
                // console.log('not found ', obj.column0);
                notFoundCounter++;
              }
              console.log('found ', foundCounter , ' not found ', notFoundCounter);
            });
          });
  res.send('done');
});


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
          // c [
          //     {name: 'Bob',  lang: 'French, English'},
          //     {name: 'Mary', lang: 'English'}
          // ];
       });
      csvWriter.writeRecords(records)       // returns a promise
          .then(() => {
              console.log('...Done');
          });
    // userObj=JSON.parse(JSON.stringify(product));//data to add
    // fs.appendFile(path.resolve(__dirname, 'orders/productWithoutCodes.csv'), userObj, (err) => {
    //     if (err) console.error('Couldn\'t append the data');
    //     console.log('The data was appended to file!');
    // });
  // Product.find({"product_code" : { $ne : null }}, function (err, product) { 
    console.log(err, product.length);
   // product.map(obj => {
      // if(obj.product_code && obj.product_code !== "" && obj.product_code !== " ")
     // console.log('====> ', obj.name , ' ==> ', obj.product_code, '==>', counter);
     // counter++;
    //});
    res.send('done');
  })
});
function getProduct(productName, callback) {
  // var productNameLower = productName.toString().toLowerCase();
  // productNameLower = productNameLower.replace(/ /g, '-');
  // console.log('=====>  ', productNameLower ,'\n');
  Product.findOne({name: productName}, function (err, product) {
    callback(err, product);
  })
}
// Start the server
const port = process.env.PORT || 3000;
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