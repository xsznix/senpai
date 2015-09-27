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
	if (!connStr) return; // static test

	var matches = connStr.match(/^Database=(\w+);Data Source=([\w\-\.]+);User Id=(\w+);Password=(\w+)$/);
	if (!matches) {
		throw new Error('failed to parse database connection string');
	}
	dbUrl = {
		host: matches[2],
		database: matches[1],
		user: matches[3],
		password: matches[4],
		protocol: 'mysql'
	};
})();

// Init ORM
var orm = require('orm');
var Account, ConnectToken;
if (dbUrl)
	orm.connect(dbUrl, function (err, db) {
		if (err) throw err;

		// Account information
		Account = db.define('account', {
			c_id: String,
			first_name: String,
			last_name: String,
			email: String
		});

		ConnectToken = db.define('connect_token', {
			token: String
		});

		db.sync(function (err) {
			if (err) throw err;
		});
	});

// Init express
var express = require('express');
var ejs = require('ejs');
ejs.delimiter = '$';
var cookieSession = require('cookie-session');
var bodyParser = require('body-parser');
var app = express();

app.set('view engine', 'ejs');
app.use('/static', express.static('static'));
app.use('/lib', express.static('node_modules'));
app.use(cookieSession({
	name: 'session',
	keys: [process.env['SESSION_KEY_1'] || 'asdf', process.env['SESSION_KEY_2'] || 'hjkl']
}));
app.use(bodyParser.urlencoded({ extended: true }));

// Routes

app.get('/', function (req, res) {
	if (req.session.account_id)
		res.redirect('/home');
	else
		res.render('index');
});

app.get('/home', function (req, res) {
	// User must be logged in
	if (req.session.account_id == null) {
		res.redirect('/');
		return;
	}

	res.render('home');
});

app.get('/my_lists', function (req, res) {
	// User must be logged in
	if (req.session.account_id == null) {
		res.json([]);
		return;
	}

	// Get lists
	cc.accounts(req.session.account_id).messages().get({ limit: 250 }, function (err, response) {
		if (err) {
			res.status(500).send('Could not get messages: ' + err.message);
			return;
		}

		var messages = response.body;
		var lists = {}, listsArr = [];

		messages.forEach(function (message) {
			if (!message.list_headers)
				return;

			var unsub = message.list_headers['list-unsubscribe'];
			if (!unsub)
				return;

			if (unsub.length)
				unsub = unsub[0];

			var unsubLinkList = unsub.split(',').map(function (link) {
				return link.match(/\s*<?(.*)>?\s*/)[1];
			});

			// Get information from lists
			var sender = message.addresses.from;
			var subject = message.subject;
			var date = message.date;

			if (!lists[sender.email]) {
				lists[sender.email] = {
					message_id: message.message_id,
					sender: sender,
					unsub_links: unsubLinkList,
					emails: []
				};
			}

			lists[sender.email].emails.push({
				subject: subject,
				date: date
			});
		});

		// Array-ify to make Backbone happy
		for (var k in lists) {
			if (lists.hasOwnProperty(k)) {
				listsArr.push({
					message_id: lists[k].message_id,
					sender_name: lists[k].sender.name,
					sender_email: k,
					unsub_links: lists[k].unsub_links,
					emails: lists[k].emails
				});
			}
		}

		res.json(listsArr);
	});
});

app.post('/login', function (req, res) {
	if (!req.body.email) {
		res.status(404).send('Missing email parameter');
		return;
	}

	Account.find({ email: req.body.email }, function (err, accounts) {
		if (err) {
			res.status(500).send('Query for account failed: ' + err.message);
			return;
		}

		if (!accounts.length) {
			res.redirect('/oauth/connect?email=' + encodeURIComponent(req.body.email));
			return;
		}

		// Hackathon-quality authentication
		req.session.account_id = accounts[0].c_id;
		res.redirect('/home');
	});
});

app.get('/logout', function (req, res) {
	req.session.account_id = null;
	res.redirect('/');
});

app.get('/oauth/connect', function (req, res) {
	// Get a connect_token
	cc.connectTokens().post({
		callback_url: 'http://senpai.azurewebsites.net/oauth/callback',
		email: req.query.email
	}, function (err, response) {
		if (err) {
			res.status(500).send('Could not get token from ContextIO: ' + err.message);
			return;
		}

		response = response.body;

		var redirectUrl = response.browser_redirect_url;

		// Save connect token
		ConnectToken.create({
			token: response.token
		}, function (err) {
			if (err) {
				res.status(500).send('Could not save connect_token to database: ' + err.message);
				return;
			}

			// Send user to ContextIO to complete login
			res.redirect(redirectUrl);
		});
	});
});

app.get('/oauth/callback', function (req, res) {
	var token = req.query['contextio_token'];

	// Verify validity of token
	ConnectToken.find({ token: token }, function (err, tokens) {
		if (err) {
			res.status(500).send('Query to find connect token failed: ' + err.message);
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
			if (err) {
				res.status(500).send('Could not retrieve account data by account token: ' + err.message);
				return;
			}

			token = token.body;
			Account.create({
				c_id: token.account.id,
				first_name: token.account.first_name,
				last_name: token.account.last_name,
				email: token.account.email_addresses[0]
			}, function (err) {
				if (err) {
					res.status(500).send('Could not create account: ' + err.message);
					return;
				}

				// Set session and continue
				req.session.account_id = token.account.id;
				res.redirect('/home');
			});
		});
	});
});

// Start express
var server = app.listen(process.env.port || 3000);
