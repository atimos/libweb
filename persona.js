(function(window, document, navigator, undefined) {
	'use strict';

	var lib = (window.lib = window.lib || {}),
		xhr = lib.xhr(),
		events = {};

	lib.persona = {
		signIn: function() {
			navigator.id.request();
		},
		signOut: function() {
			navigator.id.logout();
		},
		addEventListener: function(event, fn) {
			events[event] = fn;
		}
	};

	function loggedin(assertion) {
		xhr.abort(true).post('/persona/sign-in', {body: {assertion: assertion}}, function(evt, data) {
			var cb;

			if ( data.json.status === true ) {
				cb = events['sign-in'];
			} else {
				cb = events.error;
			}
			if ( cb !== undefined && Object.prototype.toString.call(cb) === '[object Function]' ) {
				cb.call(null, data.json);
			}
		});
	}

	function loggedout() {
		xhr.abort(true).get('/persona/sign-out', function(evt, data) {
			var cb;

			if ( data.json.status === true ) {
				cb = events['sign-out'];
			} else {
				cb = events.error;
			}
			if ( cb !== undefined && Object.prototype.toString.call(cb) === '[object Function]' ) {
				cb.call(null, data.json);
			}
		});
	}

	if ( navigator.id !== undefined ) {
		navigator.id.watch({
			onlogin: loggedin,
			onlogout: loggedout
		});
	}

}(this, this.document, this.navigator));

(function(window, document, undefined) {
	'use strict';
	var sign_in = document.querySelector('#sign-in'),
		sign_out = document.querySelector('#sign-out');

	window.utils.id.addEventListener('sign-in', function() {
		if ( sign_in !== null ) {
			sign_in.style.display = 'none';
			sign_out.style.display ='inline-block';
		}
	});

	window.utils.id.addEventListener('sign-out', function() {
		if ( sign_out !== null ) {
			sign_in.style.display = 'inline-block';
			sign_out.style.display = 'none';
		}
	});

	sign_out.addEventListener('click', function(evt) {
		evt.preventDefault();
		window.utils.id.signOut();
	}, false);

	sign_in.addEventListener('click', function(evt) {
		evt.preventDefault();
		window.utils.id.signIn();
	}, false);
}(this, this.document));
