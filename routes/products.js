const express = require('express');
const router = express.Router();
const paths = require('../config/paths');
const Product = require('../models/product');
const Brand = require('../models/brand');
const Category = require('../models/category');
const validateDiscountCode = require('../service/validateDiscountCode');
const applyDiscount = require('../service/applyDiscount');
const Warehouse = require('../models/warehouses');

let allBrandSlugs = [];

router.get('/', function (req, res) {
    const loggedIn = (req.isAuthenticated()) ? true : false;    

    
    Product.find({instock:true}, function (err, products) {
        
        if (err) console.log(err);

        applyDiscountPrice(loggedIn, res, products);

        const breadcumsHtml = '<li><a href="/">Home <span class="sep"> >> </span> </a><a href="/products">Products</a></li>';

        res.render('all_products', {
            title: 'All products',
            products: products,
            count: products.length,
            loggedIn: loggedIn,
            productImageUrl: paths.s3ImageUrl,
            breadcumsHtml: breadcumsHtml
        });
    });

});

router.post('/search', (req, res) => {
    let searchText = req.body.search;

    if(searchText) {       
        //store the searchText on session for redirect product search page
        req.session.searchTerm = searchText;
    }else {
        searchText = req.session.searchTerm;
    }

    const loggedIn = (req.isAuthenticated()) ? true : false;
   
    searchProduct(searchText, loggedIn, res);
  
});

router.get('/search', (req, res) => {

    const loggedIn = (req.isAuthenticated()) ? true : false;
    const searchText = req.session.searchTerm;
   
    searchProduct(searchText, loggedIn, res);

});

router.get('/:brand', function (req, res) {
    const brandSlug = req.params.brand;

    if(brandSlug === 'search') {
        res.redirect('/products/search');
        return;
    }

    const loggedIn = (req.isAuthenticated()) ? true : false;
    //first find warehouse name
    Brand.findOne({"slug": brandSlug}, function (err, brandInfo) {
        //now find brand
        const breadcumsHtml = '<li><a href="/">Home <span class="sep"> >> </span> </a>'+ brandInfo.name +' </li>';
        Brand.find({"warehouse": brandInfo.warehouse}, function (err, c) {
            Product.find({brand: brandSlug, instock: true}, function (err, products) {
                if (err)
                    console.log(err);

                applyDiscountPrice(loggedIn, res, products);

                res.render('brand_products', {
                    title: (c && c.name) ? c.name : '',
                    products: products,
                    count: products.length,
                    loggedIn: loggedIn,
                    brands: c,
                    productImageUrl: paths.s3ImageUrl,
                    breadcumsHtml: breadcumsHtml
                });
            });
        });
    });

});

router.get('/warehouse_products/:warehouse', function (req, res) {
    // const brandSlug = req.params.brand;
    const warehouseSlug = req.params.warehouse;

    // if(brandSlug === 'search') {
    //     res.redirect('/products/search');
    //     return;
    // }

    const loggedIn = (req.isAuthenticated()) ? true : false;

    Brand.find({"warehouse": warehouseSlug}, function (err, c) {
        Product.find({warehouse: warehouseSlug, instock: true}, function (err, products) {
            if (err)
                console.log(err);

        Warehouse.findOne({"slug": warehouseSlug}, function (err, warehouse) {
                applyDiscountPrice(loggedIn, res, products);
                const breadcumsHtml = '<li><a href="/">Home <span class="sep"> >> </span> </a><a href="/products">Products <span class="sep"> >> </span> </a>'+ warehouse.name +' </li>';
                res.render('brand_products', {
                    title: (c && c.name) ? c.name : '',
                    products: products,
                    count: products.length,
                    loggedIn: loggedIn,
                    brands: c,
                    productImageUrl: paths.s3ImageUrl,
                    breadcumsHtml: breadcumsHtml
                });
            });
        });
    });

});

router.get('/warehouse_brand/:brand/:warehouse', function (req, res) {
    const brandSlug = req.params.brand;
    const warehouseSlug = req.params.warehouse;

    if(brandSlug === 'search') {
        res.redirect('/products/search');
        return;
    }

    const loggedIn = (req.isAuthenticated()) ? true : false;

    Warehouse.findOne({"slug": warehouseSlug}, function (err, warehouseInfo) {
        Brand.find({"warehouse": warehouseSlug}, function (err, c) {
            Brand.findOne({"slug": brandSlug}, function (err, brandInfo) {
                Product.find({brand: brandSlug, instock: true}, function (err, products) {
                    if (err)
                        console.log(err);

                    applyDiscountPrice(loggedIn, res, products);
                    const breadcumsHtml = '<li><a href="/">Home <span class="sep"> >> </span> </a><a href="/products/warehouse_products/'+ warehouseSlug +'"> '+ warehouseInfo.slug +' <span class="sep"> >> </span> </a>'+ brandInfo.name +' </li>';
                    res.render('brand_products', {
                        title: (c && c.name) ? c.name : '',
                        products: products,
                        count: products.length,
                        loggedIn: loggedIn,
                        brands: c,
                        productImageUrl: paths.s3ImageUrl,
                        breadcumsHtml: breadcumsHtml
                    });
                });
            });
        });
    });
});

router.get('/:brand/:product', function (req, res) {
    const loggedIn = (req.isAuthenticated()) ? true : false;
    const brandSlug = req.params.brand;
    let products = [];
    //first find warehouse name
    Brand.findOne({"slug": brandSlug}, function (err, brandInfo) {
        //now find brand
        Brand.find({"warehouse": brandInfo.warehouse}, function (err, c) {
            Product.findOne({slug: req.params.product}, function (err, product) {
                //find warehouse
                Warehouse.findOne({slug: brandSlug}, function(errW, warehouseInfo) {
                    if (err) {
                        console.log(err);
                    } else {  
                        products.push(product);            
                        applyDiscountPrice(loggedIn, res, products);
                        const breadcumsHtml = '<li><a href="/">Home <span class="sep"> >> </span> </a><a href="/products/warehouse_products/'+ warehouseInfo.slug +'">'+ warehouseInfo.name +' <span class="sep"> >> </span> </a><a href="/products/'+ brandSlug +'">'+ brandInfo.name +'<span class="sep"> >> </span></a> '+ product.name +'</li>';
                        res.render('product', {
                            title: product.name,
                            p: product,
                            brands: c,
                            productImageUrl: paths.s3ImageUrl,
                            loggedIn: loggedIn,
                            productImageUrl: paths.s3ImageUrl,
                            breadcumsHtml: breadcumsHtml
                        });
                    }
                });
            });
        });
    });

});

router.get('/categories/category/:category', function (req, res) {
    const categorySlug = req.params.category;
    const loggedIn = (req.isAuthenticated()) ? true : false;

    Category.findOne({slug: categorySlug}, function (err, c) {
        Product.find({category: categorySlug, instock: true}, function (err, products) {
            if (err)
                console.log(err);

            applyDiscountPrice(loggedIn, res, products);

            const breadcumsHtml = '<li><a href="/">Home <span class="sep"> >> </span> </a><a href="/products/categories/category/'+ categorySlug +'">'+ c.name +'</a></li>';

            res.render('brand_products', {
                title: (c && c.name) ? c.name : '',
                products: products,
                count: products.length,
                loggedIn: loggedIn,
                productImageUrl: paths.s3ImageUrl,
                breadcumsHtml: breadcumsHtml
            });
        });
    });

});


router.get('/warehouses/warehouse/:warehouse', function (req, res) {
    const warehouseSlug = req.params.warehouse;
    const loggedIn = (req.isAuthenticated()) ? true : false;

    // Brand.find(function (err, brands) {
    //     if (err) {
    //         console.log(err);
    //     } else {
    //         app.locals.brands = brands;
    //     }
    // }).sort({'name': 1});
    Brand.find({"warehouse": warehouseSlug}, function (err, brands) {
        Category.findOne({}, function (err, c) {
            Warehouse.findOne({slug: warehouseSlug}, function (err, warehouse) {
                if (err)
                    console.log(err);

                //applyDiscountPrice(loggedIn, res, products);
                const breadcumsHtml = '<li><a href="/">Home <span class="sep"> >> </span> </a><a href="/products/warehouse_products/'+ warehouse.slug +'">'+ warehouse.name +' </li>';
                res.render('warehouse_brands', {
                    title: (c && c.name) ? c.name : '',
                    count: brands.length,
                    loggedIn: loggedIn,
                    brandImageUrl: paths.s3BrandImageUrl,
                    brands: brands,
                    warehouse: warehouseSlug,
                    breadcumsHtml: breadcumsHtml
                });
                // res.render('brand_products', {
                //     title: (c && c.name) ? c.name : '',
                //     products: products,
                //     count: products.length,
                //     loggedIn: loggedIn,
                //     productImageUrl: paths.s3ImageUrl,
                //     brands: brands
                // });
           });
        });
    });
});

module.exports = router;

function searchProduct(searchText, loggedIn, res) {
    if(!searchText) {
        res.redirect('/');
        return;
    }

    //    db.things.find({
    //     $or : [ 
    //         {"first_name": "john"},
    //         {"last_name": "john"}
    //     ],
    //     "phone": "12345678"         
    // })
    Product.find({"$or": [{ "name": { "$regex": new RegExp(searchText, "i")} }, { "product_code": { "$regex": new RegExp(searchText, "i") }}], instock: true}, (err, products) => { 
        if (err) {
            console.log(err);
        }
        const breadcumsHtml = '<li><a href="/">Home <span class="sep"> >> </span> </a><a href="/products">Products <span class="sep"> >> </span> </a> Serach </li>';
        applyDiscountPrice(loggedIn, res, products);
        res.render('all_products', {
            title: 'search products',
            searchText: searchText,
            products: products,
            count: products.length,
            loggedIn: loggedIn,
            productImageUrl: paths.s3ImageUrl,
            breadcumsHtml: breadcumsHtml
        });
    });
}

function applyDiscountPrice(loggedIn, res, products) {
    if (loggedIn) {
        const isValidDiscountCode = validateDiscountCode(res.locals.user.discount_code, allBrandSlugs);
        if (isValidDiscountCode) {
            products.map(product => {
                applyDiscount(res.locals.user.discount_code, product);
            });
        }
    }
}

Brand.find(function (err, brands) {
    if (err) {
        console.log(err);
    } else {
        allBrandSlugs = brands.map(brand => brand.slug);
    }
});

