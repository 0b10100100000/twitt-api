const express = require('express');
const Twit = require('twit');
const bodyParser = require('body-parser');
const cors = require('cors');
const randomstring = require('randomstring');
var MongoClient = require('mongodb').MongoClient;
const config = require("./config/config.js");

// routes
// const publicRoutes = require('./routes/index.js');
// const apiRoutes = require('./routes/private.js');

const jwt = require('jsonwebtoken'); // used to create, sign, and verify tokens
// const morgan = require('morgan');

let db;
// Connect to the db
MongoClient.connect(config.database, function (err, database) {
    if (err) throw err;
    db = database;
    console.log("Connected to mongodb");
});

let T = new Twit({
    consumer_key: 'S6vYP6xcsOKKtbxGfdo7Sc9lJ',
    consumer_secret: 'zgwm4wJuaVMgFT7OEgUPs90c31d6DOXIZ9B6MQd7fkF5of5uTh',
    access_token: '962926345608036352-8C2FYmED0S7q3THets61aMlPw1OeyqB',
    access_token_secret: 'DcUPKgf9bsqinUqZVrtl74nqoeSMqwK2DEYjT2Pr9EXTK',
    timeout_ms: 60 * 1000,  // optional HTTP request timeout to apply to all requests.
});

var nodemailer = require('nodemailer');

var transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: config.email.username,
        pass: config.email.password
    }
});

const app = express();
app.set('superSecret', config.jwtSecret); // secret variable
// use morgan to log requests to the console
// app.use(morgan('dev'));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: false }));
app.use(cors());

// app.use('/', publicRoutes);
// app.use('/api', apiRoutes);

app.listen(3000);
console.log("server running at port 3000");

let locationIds = {
    'bangalore': 2295420,
    'delhi': 2295019,
    'mumbai': 2295411,
    'kolkata': 2295386
};

// register
app.post('/register', (req, res) => {
    console.log("/register");
    let obj = {
        name: req.body.name,
        email: req.body.email,
        password: req.body.password,
        mobile: req.body.mobile
    };

    console.log(obj);
    db.collection("users").find({ email: req.body.email }).toArray((er, result) => {
        if (er)
            res.send({ status: 500, message: "Internal server error." });
        else {
            if (result.length === 0) {
                db.collection("users").insert(obj, (err, response) => {
                    if (err)
                        res.send({ status: 500, message: "Internal server error." });
                    else {
                        res.send({ status: 200, message: "Registered successfully." });
                    }
                });
            } else {
                res.send({ status: 400, message: "Your email is already registered." });
            }
        }
    })
});

// login
app.post('/login', (req, res) => {
    console.log("/login");
    let email = req.body.email;
    let password = req.body.password;
    console.log(JSON.stringify(req.body));

    db.collection("users").find({ email: email }).toArray((err, response) => {
        if (err)
            res.send({ status: 500, message: "Internal server error." });
        else {
            if (response.length === 0) {
                // email does not match
                res.send({ status: 406, result: "Your email is not registered with us." });
            } else if (response.length === 1) {
                // logged in
                if (response[0].password == req.body.password) {
                    // if user is found and password is right
                    // create a token with only our given payload
                    const payload = {
                        email: email
                    };
                    let jwtToken = jwt.sign(payload, app.get('superSecret'));
                    console.log("jwt created : " + jwtToken);
                    res.send({ status: 200, result: "match", message: "Logged in.", jwt: jwtToken });
                }
                else
                    res.send({ status: 400, message: "Invalid password." });
            }
        }
    });
});

// forgot-password
app.post('/forgot-password', (req, res) => {
    console.log("/forgot-password");
    let email = req.body.email;
    console.log(JSON.stringify(req.body));

    let token = randomstring.generate();
    db.collection("users").count({ "email": email }, (err, count) => {
        // console.log(count);
        if (count === 1) {

            db.collection("users").update({ "email": email }, { $set: { "token": token } }, function (err2, result) {
                if (err2)
                    res.send({ status: 500, message: "Internal server error." });
                else {
                    let message = "Click the link to reset the password.";
                    message += " http://localhost:4200/reset/" + token;
                    message += "\n Please ignore if not done by you.";

                    var mailOptions = {
                        from: '0b10100100000@gmail.com',
                        to: email,
                        subject: 'Password reset',
                        text: message
                    };

                    transporter.sendMail(mailOptions, function (error, info) {
                        if (error) {
                            console.log(error);
                        } else {
                            console.log('Email sent: ' + info.response);
                            res.send({ status: 200, message: 'Email sent.' });
                        }
                    });
                }
            });
        } else {
            res.send({ "status": 400, "message": "This email does not exist." });
        }

    });
});

// reset password
app.post('/reset/:token', (req, res) => {
    console.log("/reset");
    let token = req.params.token;
    let password = req.body.newPassword;

    // console.log(token);
    // console.log(req.body.newPassword);

    db.collection("users").count({ "token": token }, (err, count) => {
        // console.log(count);
        if (count === 1) {

            db.collection("users").update({ "token": token }, { $set: { "password": password } }, function (err2, result) {
                if (err2)
                    res.send({ status: 500, message: "Internal server error." });
                else {
                    res.send({ "status": 200, "message": "Password updated successfully." });
                }
            });
        } else {
            res.send({ "status": 400, "message": "This email does not exist." });
        }
    });
});


// protected routes
// ---------------------------------------------------------------
// route middleware to verify a token
app.use(function (req, res, next) {
    // console.log("validating jwt...");
    // check header or url parameters or post parameters for token
    var token = req.body.token || req.query.token || req.headers['x-access-token'];

    // decode token
    if (token) {

        // verifies secret and checks exp
        jwt.verify(token, app.get('superSecret'), function (err, decoded) {
            if (err) {
                return res.json({ success: false, message: 'Failed to authenticate token.' });
            } else {
                // if everything is good, save to request for use in other routes
                req.decoded = decoded;
                next();
            }
        });

    } else {
        // if there is no token
        // return an error
        return res.status(403).send({
            success: false,
            message: 'No token provided.'
        });

    }
});
// -------------------------------------------------------------------

// get feed for a keyword
app.get('/feeds', (req, res) => {
    console.log("/feeds");
    const keyword = 'modi';
    let result;

    var params = {
        q: keyword,
        count: 20
    }

    T.get('search/tweets', params, gotData);

    function gotData(err, data, response) {
        if (err)
            res.send({ status: 500, message: "Internal server error." });
        else
            res.send({ status: "200", feeds: data, message: "Found feeds." });
    }
});

// get feed for a keyword
app.get('/trending-topics/:location', (req, res) => {
    console.log("/trending-topics");
    var params = {
        id: locationIds[req.params.location]
    }
    console.log(req.params.location + " : " + locationIds[req.params.location]);

    T.get('trends/place', params, gotData);

    function gotData(err, data, response) {
        if (err)
            res.send({ status: 500, message: "Internal server error." });
        else
            res.send(data);
        // console.log(data);
    }
});

// search tweet
app.post('/search', (req, res) => {
    console.log("/search");
    var params = {
        q: req.body.keyword
    }
    console.log(params.q);
    T.get('search/tweets', params, gotData);

    function gotData(err, data, response) {
        if (err)
            res.send({ status: 500, message: "Internal server error." });
        else
            res.send(data);
        // console.log(data);
    }
});

// get graph data
app.get('/graph-data', (req, res) => {
    console.log("/graph-data");

    let cities = ['bangalore', 'mumbai', 'delhi', 'kolkata'];
    let tweets = [10000, 5600, 2300, 9000];
    res.send({ "status": 200, "message": "Total tweets count.", "data": { "cities": cities, "tweets": tweets } });
});