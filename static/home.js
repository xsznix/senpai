$(function () {
	var Newsletter = Backbone.Model.extend({});

	var NewsletterCollection = Backbone.Collection.extend({
		model: Newsletter,
		url: '/my_lists'
	});

	var NewsletterView = Backbone.View.extend({
		tagName: 'li',
		template: _.template($('#list-item').html()),

		render: function () {
			this.$el.html(this.template(this.model.toJSON()));
		}
	});

	var news = new NewsletterCollection();
	var $lists = $('#lists');
	news.bind('add', function (model) {
		console.log(model);
		$lists.append(new NewsletterView({ model: model }));
	});
	news.fetch();
});