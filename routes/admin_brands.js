var express = require('express');
var router = express.Router();
var auth = require('../config/auth');
var isAdmin = auth.isAdmin;
// Get brand model
var Brand = require('../models/brand');
var Warehouses = require('../models/warehouses');
const bucket = require('../config/s3Bucket');
const s3Bucket = bucket('home-brand-images-new');
const paths = require('../config/paths');
const addAndRemoveImage = require('../service/addRemoveS3Image');

/*
 * GET brand index/
 */
router.get('/', isAdmin, function (req, res) {
    Brand.find(function (err, brands) {
        if (err) return console.log(err);
        res.render('admin/brands', {
            brands: brands,
            brandImageUrl: paths.s3BrandImageUrl,
        });
    }).sort({'name': 1});
});


/*
 * GET add brand
 */
router.get('/add-brand', isAdmin, function (req, res) {

    var name = "";
    Warehouses.find({}, function (err, warehouses) {        
        res.render("admin/add_brand", {
            name: name,
            warehouses
        });
    });
});

/*
 * POST pages index/
 */
router.post('/add-brand', function (req, res) {

    req.checkBody('name', 'Name must have a value.').notEmpty();
    req.checkBody('warehouse', 'Warehouse must have a value.').notEmpty();
    const imageFile = typeof req.files.image !== "undefined" ? req.files.image.name : "";

    var name = req.body.name;
    var slug = name.replace(/\s+/g, '-').toLowerCase();
    var warehouse = req.body.warehouse;

    var errors = req.validationErrors();

    if (errors) {
        console.log('errors');
        res.render('admin/add_brand', {
            errors: errors,
            name: name,
        });
    } else {
        Brand.findOne({ slug: slug }, function (err, brand) {
            if (brand) {
                req.flash('danger', 'Brand slug exists, choose another.');
                res.render('admin/add_brand', {
                    name: name,
                });
            } else {
                var brand = new Brand({
                    name: name,
                    slug: slug,
                    warehouse: warehouse,
                    image: imageFile
                });

                brand.save(function (err) {
                    if (err)
                        return console.log(err);

                    if(imageFile) {
                        const brand_image = req.files.image;
                        addAndRemoveImage(s3Bucket, 'add', imageFile, brand_image);
                    }

                    req.flash('success', 'Brand added!');
                    res.redirect('/admin/brands');
                });
            }
        });
    }
});

// Sort pages function
function sortPages(ids, callback) {
    var count = 0;

    for (var i = 0; i < ids.length; i++) {
        var id = ids[i];
        count++;

        (function (count) {
            Page.findById(id, function (err, page) {
                page.sorting = count;
                page.save(function (err) {
                    if (err)
                        return console.log(err);
                    ++count;
                    if (count >= ids.length) {
                        callback();
                    }
                });
            });
        })(count);

    }
}

/*
 * GET edit page
 */
router.get('/edit-brand/:id', isAdmin, function (req, res) {

    Warehouses.find({}, function (err, warehouses) {
        Brand.findById(req.params.id, function (err, brand) {
            if (err)
                return console.log(err);

            res.render('admin/edit_brand', {
                brand,
                brandImageUrl: paths.s3BrandImageUrl,
                warehouses: warehouses
            });
        });
    });
});


/*
 * POST edit brand
 */
router.post('/edit-brand/:id', function (req, res) {

    req.checkBody('name', 'Name must have a value.').notEmpty();
    req.checkBody('warehouse', 'Warehouse must have a value.').notEmpty();
    const imageFile = typeof req.files.image !== "undefined" ? req.files.image.name : "";

    var name = req.body.name;
    var slug = name.replace(/\s+/g, '-').toLowerCase();
    var id = req.params.id;
    var warehouse = req.body.warehouse;

    var errors = req.validationErrors();

    if (errors) {
        res.render('admin/edit_brand', {
            errors: errors,
            name: name,
            id: id
        });
    } else {
        Brand.findOne({ slug: slug, _id: { '$ne': id } }, function (err, brand) {
            if (brand) {
                req.flash('danger', 'Brand name exists, choose another.');
                res.render('admin/edit_brand', {
                    name: name,
                    id: id
                });
            } else {

                Brand.findById(id, function (err, brand) {
                    if (err)
                        return console.log(err);

                        const oldImage = brand.image;
                        brand.name = name;
                        brand.slug = slug;
                        brand.warehouse = warehouse;
                        if (imageFile != "") {
                            brand.image = imageFile;
                        }
                        brand.save(function (err) {
                            const brand_image = req.files.image;
                            if (err)
                                return console.log(err);

                            if (imageFile != "") {
                                if(oldImage) {                                
                                    addAndRemoveImage(s3Bucket, 'delete', oldImage)
                                }                            
                                addAndRemoveImage(s3Bucket, 'add', imageFile, brand_image);                                                        
                            }

                            Brand.find(function (err, brands) {
                                if (err) {
                                    console.log(err);
                                } else {
                                    req.app.locals.brands = brands;
                                }
                            });

                            req.flash('success', 'brand edited!');
                            res.redirect('/admin/brands/edit-brand/' + id);
                        });

                    });


            }
        });
    }

});

/*
 * GET delete brand
 */
router.get('/delete-brand/:id', isAdmin, function (req, res) {
   
    Brand.findByIdAndRemove(req.params.id, function (err) {
        if (err)
            return console.log(err);

        Brand.find(function (err, brands) {
            if (err) {
                console.log(err);
            } else {
                req.app.locals.brands = brands;
            }
        });

        req.flash('success', 'brand deleted!');
        res.redirect('/admin/brands/');
    });
});


// Exports
module.exports = router;