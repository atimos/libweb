(function(window, document, undefined) {
	'use strict';
	window.lib = window.lib || {};
	window.lib.ui = window.lib.ui || {};


	window.lib.ui.message = function(messages) {
		var tpl = document.createElement('p'), timeout_list = {};

		tpl.appendChild(document.createElement('a'));
		tpl.lastChild.textContent = 'X';
		tpl.lastChild.href = '#';
		tpl.appendChild(document.createElement('span'));

		function set(message, options) {
			var message_node = tpl.cloneNode('true'), old_node, timeout;

			if ( options.unsafe === true ) {
				message_node.children[1].innerHTML = message;
			} else {
				message_node.children[1].textContent = message;
			}

			options = options || {};

			if ( options.id !== undefined ) {
				old_node = messages.querySelector('#' + options.id);
				message_node.id = options.id;
			}

			if ( options.type !== undefined ) {
				message_node.className = options.type;
			}
			
			if ( options.sticky !== undefined ) {
				message_node.removeChild(message_node.children[0]);
			}

			if ( options.top === true && messages.children.length > 0 ) {
				messages.insertBefore(message_node, messages.children[0]);
			} else if ( old_node ) {
				messages.insertBefore(message_node, old_node);
			} else {
				messages.appendChild(message_node);
			}
			if ( old_node ) {
				messages.removeChild(old_node);
			}

			if ( options.timeout ) {
				setTimeout(function() {
					if ( message_node && message_node.parentNode ) {
						message_node.parentNode.removeChild(message_node);
						message_node = null;
					}
				}, options.timeout);
			}
		}

		function del(id) {
			var node = messages.querySelector('#' + id);

			if ( node ) {
				node.parentNode.removeChild(node);
			}
		}

		messages.addEventListener('click', function(evt) {
			if ( evt.target.nodeName.toLowerCase() === 'a' ) {
				evt.preventDefault();
				messages.removeChild(evt.target.parentNode);
			}
		});

		return {
			set: set,
			del: del
		};
	};
}(window, window.document, void(0)));
