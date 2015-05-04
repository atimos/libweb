'use strict';

let _pos = Symbol('pos'),
	_queue = Symbol('queue'),
	_iter = Symbol('iter');

export class Iter {
	constructor(iterator) {
		this[_queue] = [];
		this[_pos] = -1;
		this[_iter] = iterator;
	}

	next() {
		let value;

		this[_pos] += 1;
		value = this[_iter][this[_pos]];

		this[_queue].forEach(action => {
			value = action(value, this[_pos]);
		});

		return value;
	}

	skip(n) {
		for ( let i = n; i > 0; i -= 1 ) {
			if ( this.next() === undefined ) {
				break;
			}
		}
	}

	take(n) {
		let slice = [];

		for ( let i = n; i > 0; i -= 1 ) {
			let value = this.next();

			if ( value === undefined ) {
				break;
			}

			slice.push(value);
		}

		return new Iter(slice);
	}

	toArray() {
		let result = [];

		this.forEach(item => {
			result.push(item);
		});

		return result;
	}

	forEach(fn) {
		let item;

		while ( (item = this.next()) !== undefined ) {
			fn(item, this[_pos]);
		}
	}

	map(fn) {
		this[_queue].push(function(item, index) {
			return this.fn(item, index);
		}.bind({fn:fn}));
	}
}

export class IterAsync extends Iter {
}
