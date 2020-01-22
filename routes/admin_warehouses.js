var express = require('express');
var router = express.Router();
var auth = require('../config/auth');
const paths = require('../config/paths');
var isAdmin = auth.isAdmin;
const bucket = require('../config/s3Bucket');
const addAndRemoveImage = require('../service/addRemoveS3Image');
// Get category model
var Warehouse = require('../models/warehouses');
const s3Bucket = bucket('home-brand-images-new');

/* Get warehouses index */
router.get('/', isAdmin, function (req, res) {
    Warehouse.find(function (err, warehouses) {
        if (err) return console.log(err);
        res.render('admin/warehouses', {
            warehouses: warehouses
        });
    })
});

/*  add category */
router.get('/add-warehouse', isAdmin, function (req, res) {

    var name = "";

    res.render("admin/add_warehouse", {
        name: name,
    });
});

/* Post page index */

router.post('/add-warehouse', function (req, res) {

    const imageFile = typeof req.files.image !== "undefined" ? req.files.image.name : "";

    req.checkBody('name', 'Name must have a value.').notEmpty();
    req.checkBody('image', 'You must upload an image').isImage(imageFile);

    var name = req.body.name;
    var slug = name.replace(/\s+/g, '-').toLowerCase();

    var errors = req.validationErrors();

    if (errors) {
        console.log('errors');
        res.render('admin/add_warehouse', {
            errors: errors,
            name: name,
        });
    } else {
        Warehouse.findOne({ slug: slug }, function (err, warehouse) {
            if (warehouse) {
                req.flash('danger', 'Warehouse slug exists, choose another.');
                res.render('admin/add_warehouse', {
                    name: name,
                });
            } else {
                var warehouse = new Warehouse({
                    name: name,
                    slug: slug,
                    image: imageFile
                });

                warehouse.save(function (err) {
                    if (err)
                        return console.log(err);

                    if(imageFile) {
                        const warehouse_image = req.files.image;
                        addAndRemoveImage(s3Bucket, 'add', imageFile, warehouse_image);
                    }

                    req.flash('success', 'Warehouse added!');
                    res.redirect('/admin/warehouses');
                });
            }
        });
    }
});

/*
 * GET edit page
 */
router.get('/edit-warehouse/:id', isAdmin, function (req, res) {

    Warehouse.findById(req.params.id, function (err, warehouse) {
        if (err)
            return console.log(err);

        res.render('admin/edit_warehouse', {
            warehouse,
            brandImageUrl: paths.s3BrandImageUrl
        });
    });

});


/*
 * POST edit warehouse
 */
router.post('/edit-warehouse/:id', function (req, res) {

    const imageFile = typeof req.files.image !== "undefined" ? req.files.image.name : "";

    req.checkBody('name', 'Name must have a value.').notEmpty();

    const name = req.body.name;
    const slug = name.replace(/\s+/g, '-').toLowerCase();
    const id = req.params.id;
    const display = req.body.display;

    const errors = req.validationErrors();

    if (errors) {
        res.render('admin/edit_warehouse', {
            errors: errors,
            name: name,
            id: id
        });
    } else {
        Warehouse.findOne({ slug: slug, _id: { '$ne': id } }, function (err, warehouse) {
            if (warehouse) {
                req.flash('danger', 'Warehouses name exists, choose another.');
                res.render('admin/edit_warehouse', {
                    name: name,
                    id: id
                });
            } else {

                Warehouse.findById(id, function (err, warehouse) {
                    if (err)
                        return console.log(err);

                        const oldImage = warehouse.image;

                        warehouse.name = name;
                        warehouse.slug = slug;

                        if (imageFile != "") {
                            warehouse.image = imageFile;
                        }
                        warehouse.display = display == 'on' ? true : false;

                        warehouse.save(function (err) {
                            const warehouse_image = req.files.image;
                            if (err)
                                return console.log(err);

                            if (imageFile != "") {
                                if(oldImage) {                                
                                    addAndRemoveImage(s3Bucket, 'delete', oldImage)
                                }                            
                                addAndRemoveImage(s3Bucket, 'add', imageFile, warehouse_image);                                                        
                            }

                            Warehouse.find(function (err, categories) {
                                if (err) {
                                    console.log(err);
                                } else {
                                    req.app.locals.categories = categories;
                                }
                            });

                            req.flash('success', 'warehouse edited!');
                            res.redirect('/admin/warehouses/edit-warehouse/' + id);
                        });

                });


            }
        });
    }

});

/*
 * GET delete warehouse
 */
router.get('/delete-warehouse/:id', isAdmin, function (req, res) {
    Warehouse.findByIdAndRemove(req.params.id, function (err) {
        if (err)
            return console.log(err);

            Warehouse.find(function (err, categories) {
            if (err) {
                console.log(err);
            } else {
                req.app.locals.categories = categories;
            }
        });

        req.flash('success', 'warehouse deleted!');
        res.redirect('/admin/warehouses/');
    });
});


// Exports
module.exports = router;



