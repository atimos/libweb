'use strict';

export function node(node, data) {
	let tmp = document.createDocumentFragment();
	tmp.appendChild(node);

	Array.prototype.forEach.call(tmp.querySelectorAll('[data-tpl-val]'), node => {
		node.dataset.tplVal.split('|')
			.some(content => {
				content = content.trim();

				if ( data[content] !== undefined ) {
					node.textContent = data[content];
					return true;
				}
			});

		delete node.dataset.tplVal;
	});

	Array.prototype.forEach.call(tmp.querySelectorAll('[data-tpl-attr]'), node => {
		node.dataset.tplAttr.split(',').forEach(attribute => {
			let [name, value] = attribute.split(':')
					.map(item => {
						return item.trim();
					}),
				_data = data[value||name];

			switch ( typeof _data ) {
				case 'undefined':
					node.setAttribute(name, '');
					break;
				case 'boolean':
					node.setAttribute(name, value||name);
					break;
				default:
					node.setAttribute(name, _data);
			}
		});

		delete node.dataset.tplAttr;
	});

	tmp.removeChild(tmp.children[0]);
}

