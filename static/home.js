$(function () {
	var Newsletter = Backbone.Model.extend({});

	var NewsletterCollection = Backbone.Collection.extend({
		model: Newsletter,
		url: '/my_lists'
	});

	var NewsletterView = Backbone.View.extend({
		tagName: 'li',
		template: _.template($('#list-item').html()),

		events: {
			'click .unsub': 'markClicked'
		},

		initialize: function () {
			this.render();
		},

		render: function () {
			this.$el.html(this.template(this.model.toJSON()));
		},

		markClicked: function () {
			this.$('.unsub').addClass('clicked');
		}
	});

	var news = new NewsletterCollection();
	var $lists = $('#lists');
	news.bind('add', function (model) {
		$lists.append(new NewsletterView({ model: model }).$el);
	});
	news.fetch();
});