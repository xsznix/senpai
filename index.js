var ContextIO = require('contextio');
var cc = new ContextIO.Client({
	key: process.env['CONTEXTIO_KEY'],
	secret: process.env['CONTEXTIO_SECRET']
});

var connectionString = process.env['MYSQLCONNSTR_DefaultConnection'];

var express = require('express');
var app = express();

app.set('view engine', 'ejs');
app.use('/static', express.static('public'));

app.get('/', function (req, res) {
	res.render('index');
});

app.get('/oauth/callback', function (req, res) {
	// save req.query('contextio_token')
	res.send('lol');
});

app.get('/connstr', function (req, res) {
	res.send(connectionString);
});

var server = app.listen(process.env.port || 3000);