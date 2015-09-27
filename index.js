// ContextIO information
var ContextIO = require('contextio');
var cc = new ContextIO.Client({
	key: process.env['CONTEXTIO_KEY'],
	secret: process.env['CONTEXTIO_SECRET']
});

// Parse connection string
var dbUrl;
(function () {
	var connStr = process.env['MYSQLCONNSTR_default'];
	var matches = connStr.match(/^Database=(\w+);Data Source=([\w\-\.]+);User Id=(\w+);Password=(\w+)$/);
	if (!matches) {
		throw new Error('failed to parse database connection string');
	}
	dbUrl = 'mysql://' + matches[2] + ':' + matches[3] + '@' + matches[1] + '/' + matches[0];
})();

// Init ORM
var orm = require('orm');
var Account, ConnectToken;
orm.connect(dbUrl, function (err, db) {
	if (err) throw err;

	// Account information
	Account = db.define({
		c_id: String,
		first_name: String,
		last_name: String,
		email: String
	});

	ConnectToken = db.define({
		token: String
	});

	db.sync(function (err) {
		if (err) throw err;
	});
});

// Init express
var express = require('express');
var cookieSession = require('cookie-session');
var app = express();

app.set('view engine', 'ejs');
app.use('/static', express.static('public'));
app.use(cookieSession({
	name: 'session',
	keys: [process.env['SESSION_KEY_1'], process.env['SESSION_KEY_2']]
}));

// Routes

app.get('/', function (req, res) {
	res.render('index');
});

app.post('/login', function (req, res) {
	Account.find({ email: req.query.email }, function (err, accounts) {
		if (err) {
			res.status(500).send('Query for account failed');
			return;
		}

		if (!accounts.length) {
			res.status(404).send('Could not find account with that email');
			return;
		}

		// Hackathon-quality authentication
		res.session.account_id = accounts[0].c_id;
		res.redirect('/home');
	});
});

app.get('/logout', function (req, res) {
	res.session.account_id = null;
	res.redirect('/');
});

app.get('/oauth/connect', function (req, res) {
	// Get a connect_token
	cc.connectTokens().post({
		callback_url: 'http://senpai.azurewebsites.net/oauth/callback'
	}, function (err, response) {
		if (err) {
			res.status(500).send('Could not get token from ContextIO');
			return;
		}

		var redirectUrl = response.browser_redirect_url;

		// Save connect token
		ConnectToken.create({
			token: response.token
		}, function (err) {
			if (err) {
				res.status(500).send('Could not save connect_token to database');
				return;
			}

			// Send user to ContextIO to complete login
			res.redirect(redirectUrl);
		});
	});
});

app.get('/oauth/callback', function (req, res) {
	var token = req.query('contextio_token');

	// Verify validity of token
	ConnectToken.find({ token: token }, function (err, tokens) {
		if (err) {
			res.status(500).send('Query to find connect token failed');
			return;
		}

		if (!tokens.length) {
			res.status(404).send('Could not find connect token');
			return;
		}

		// Delete connect token in database, since you only need it once
		tokens[0].remove(function (err) { /* meh */ });

		// Get account information from ContextIO
		cc.connectTokens(token).get({}, function (err, token) {
			Account.create({
				c_id: token.account.id,
				first_name: token.account.first_name,
				last_name: token.account.last_name,
				email: token.account.email_addresses[0]
			}, function (err) {
				if (err) {
					res.status(500).send('Could not create account');
					return;
				}

				// Set session and continue
				res.session.account_id = token.account.id;
				res.redirect('/home');
			});
		});
	});
});

// Start express
var server = app.listen(process.env.port || 3000);
