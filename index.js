var express = require('express');
var app = express();

app.set('view engine', 'ejs');
app.use('/static', express.static('public'));

app.get('/', function (req, res) {
	res.render('index');
});

var server = app.listen(process.env.port || 3000);