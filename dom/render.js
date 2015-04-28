'use strict';

export function node(node, data) {
	let tmp = document.createDocumentFragment();
	tmp.appendChild(node);

	Array.prototype.forEach.call(tmp.querySelectorAll('[data-content]'), node => {
		node.dataset.content.split('|')
			.some(content => {
				content = content.trim();

				if ( data[content] !== undefined ) {
					node.textContent = data[content];
					return true;
				}
			});

		delete node.dataset.content;
	});

	Array.prototype.forEach.call(tmp.querySelectorAll('[data-attribute]'), node => {
		node.dataset.attribute.split(',').forEach(attribute => {
			let [name, value] = attribute.split(':')
				.map(item => {
					return item.trim();
				});

			if ( data[value||name] !== undefined ) {
				node.setAttribute(name, data[value||name]);
				return true;
			}

		});

		delete node.dataset.attribute;
	});

	tmp.removeChild(tmp.children[0]);
}

