var express = require('express');
var router = express.Router();
var passport = require('passport');
var bcrypt = require('bcryptjs');
var nodemailer = require('nodemailer');
var crypto = require('crypto');
var auth = require('../config/auth');
var email = require('../config/email');
var isAdmin = auth.isAdmin;

// Get Users model
var User = require('../models/user');

/*
* Get users
*/

router.get('/', isAdmin,  (req, res) => {
    User.find(function (err, users) {
        if (err) return console.log(err);
        res.render('admin/users', {
            users: users
        });
    })
});

/*
 * GET register
 */
router.get('/register', function (req, res) {

    res.render('register', {
        title: 'Register',
        data: {name: "", email:"", telephone:"", address_line1:"", city:"", county:"", postcode:"", country:"", username:"", password:"", password2:"", breadcumsHtml: ""}
    });

});

/*
 * POST register
 */
router.post('/register', function (req, res) {  
    
    const {name, email, telephone, address_line1, city, county, postcode, country, username, password, password2} = req.body;
    
    req.checkBody('name', 'Name is required!').notEmpty();
    req.checkBody('email', 'Email is required!').isEmail();
    req.checkBody('telephone', 'Telephone number is required!').notEmpty();
    req.checkBody('username', 'Username is required!').notEmpty();
    req.checkBody('address_line1', 'Address is required!').notEmpty();
    req.checkBody('city', 'City is required!').notEmpty();
    req.checkBody('county', 'County is required!').notEmpty();
    req.checkBody('country', 'country is required!').notEmpty();
    req.checkBody('password', 'Password is required!').notEmpty();
    req.checkBody('password2', 'Passwords do not match!').equals(password);
    
    var errors = req.validationErrors();

    if (errors) {
        res.render('register', {
            errors: errors,
            user: null,
            title: 'Register',
            data: req.body
        });
    } else {
        User.findOne({username: username}, function (err, user) {
            if (err)
                console.log(err);

            if (user) {
                req.flash('danger', 'Username exists, choose another!');
                // res.redirect('/users/register');
                res.render('register', {
                    errors: errors,
                    user: null,
                    title: 'Register',
                    data: req.body,
                    breadcumsHtml: ""
                });
            } else {
                var user = new User({
                    name,
                    email,
                    telephone,
                    address_line1,
                    city,
                    county,
                    postcode,
                    country,
                    username,
                    password,
                    admin: 0
                });

                bcrypt.genSalt(10, function (err, salt) {
                    bcrypt.hash(user.password, salt, function (err, hash) {
                        if (err)
                            console.log(err);

                        user.password = hash;

                        user.save(function (err) {
                            if (err) {
                                console.log(err);
                            } else {
                                req.flash('success', 'You are now registered!');
                                res.redirect('/users/login')
                            }
                        });
                    });
                });
            }
        });
    }

});

/*
* Edit user
*/
router.get('/edit/:id', isAdmin, (req, res) => {

        User.findById(req.params.id, function(err, user) {
            if(err) console.log(err);
            
            res.render('admin/edit_user', {
                user
            });       
        });
    });
   
router.post('/edit/:id', isAdmin, (req, res) => {
    const {name, email, telephone,  address_line1, city, county, postcode, country, discount_code} = req.body;
    const userId = req.params.id;

    req.checkBody('name', 'Name is required!').notEmpty();
    req.checkBody('email', 'Email is required!').isEmail();
    req.checkBody('telephone', 'Telephone number is required!').notEmpty();
    req.checkBody('discount_code', 'Discount code is required!').notEmpty();

    var errors = req.validationErrors();

        User.findById(userId, (err, user) => {
            if(err) console.log(err);

            user.name = name;
            user.email = email;
            user.telephone = telephone;
            user.address_line1 = address_line1,
            user.city = city,
            user.county = county,
            user.postcode = postcode,
            user.country = country,
            user.discount_code = discount_code.split(',');
            
            user.save();

            res.redirect('/users')
        });
});

router.get('/delete/:id', isAdmin, (req, res) => {

    User.findByIdAndRemove(req.params.id, (err) => {
        if (err) console.log(err);
        req.flash('success', 'user deleted!');
        res.redirect('/users');
    });

});

router.get('/login', function (req, res) {

    if (res.locals.user) res.redirect('/');
    console.log('render login');
    res.render('login', {
        title: 'Log in',
        data: {username: "", password:"", breadcumsHtml: ""}
    });

});

router.post('/login', function (req, res, next) {

    passport.authenticate('local', {
        successRedirect: '/',
        failureRedirect: '/users/login',
        failureFlash: true
    })(req, res, next);
    
});

router.get('/logout', function (req, res) {

    req.logout();
    
    req.flash('success', 'You are logged out!');
    res.redirect('/users/login');

});

router.get('/forgot', function (req, res) {

    res.render('forgot_password', {
        title: 'Forgot Password',
        email: '',
        breadcumsHtml: ""
    });

});

router.post('/forgot', function (req, res) {
    User.findOne({email: req.body.email}, (err, user) => {
            if(err) console.log(err);

            if(user) {
                crypto.randomBytes(20, function(err, buf) {
                    var token = buf.toString('hex');
                    //update user token
                    user.reset_password_link = token;
                    user.save(function(saved) { console.log('user updated');
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
                            from: 'Bizzcandy Support<support@bizzcandy.com>',
                            subject: 'Password Reset',
                            text: 'You are receiving this because you (or someone else) have requested the reset of the password for your account.\n\n' +
                              'Please click on the following link, or paste this into your browser to complete the process:\n\n' +
                              'http://' + req.headers.host + '/users/reset/' + token + '\n\n' +
                              'If you did not request this, please ignore this email and your password will remain unchanged.\n'
                        };
                        smtpTransport.sendMail(mailOptions, function(err) {
                            console.log(err);
                            if(err) {
                                req.flash('danger', 'Something went wrong, please try again.');
                            } else {
                                req.flash('success', 'An e-mail has been sent to ' + req.body.email + ' with further instructions.');
                            }
                            // done(err, 'done');
                            res.render('forgot_password', {
                                title: 'Forgot Password',
                                email: "",
                                breadcumsHtml: ""
                            });
                        });
                    });
                    
                });

            } else {
                req.flash('danger', 'User not found!');
                res.render('forgot_password', {
                    title: 'Forgot Password',
                    email: req.body.email,
                    breadcumsHtml: ""
                });
            }
        });

});

router.get('/reset/:token', function(req, res) {
  User.findOne({ reset_password_link: req.params.token}, function(err, user) {
    if (!user) {
      req.flash('error', 'Password reset token is invalid or has expired.');
      return res.redirect('/users/forgot');
    }
    res.render('reset_password', {
      user: user,
      token: req.params.token,
      title: 'Reset Password',
      breadcumsHtml: ""
    });
  });
});

router.post('/reset/:token', function(req, res) {
  User.findOne({ reset_password_link: req.params.token}, function(err, user) {
    if (user) {
        //match password and cpassword
        if(req.body.password === req.body.cpassword) {            
            //update password
            bcrypt.genSalt(10, function (err, salt) {
                bcrypt.hash(req.body.password, salt, function (err, hash) {
                    if (err)
                        console.log(err);
                    user.password = hash;
                    user.reset_password_link = "";
                    user.save(function (err) {
                        if (err) {
                            console.log(err);
                        } else {
                            //send password change email
                            var smtpTransport = nodemailer.createTransport({
                             service: email.SMTP_SERVICE,
                             auth: {
                                    user: email.SMTP_USER,
                                    pass: email.SMTP_PASS
                                }
                            });
                            var mailOptions = {
                                to: user.email,
                                from: 'Bizzcandy Support<support@bizzcandy.com>',
                                subject: 'Your password has been changed',
                                text: 'Hello,\n\n' +
                                'This is a confirmation that the password for your account ' + user.email + ' has just been changed.\n'
                            };
                            smtpTransport.sendMail(mailOptions, function(err) {
                                console.log(err);
                            });
                            req.flash('success', 'You password has been changed, login with new password.');
                            res.redirect('/users/login')
                        }
                    });
                });
            });
        } else {
            req.flash('error', 'Password and confirm password do not match.');
            return res.redirect('/users/reset/' + req.params.token);
        }
      
    } else {
        req.flash('error', 'Password reset link is invalid or has expired.');
        return res.redirect('/users/forgot');
    }
  });
});

module.exports = router;


