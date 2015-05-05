'use strict';

let _queue = Symbol('queue'),
	_size = Symbol('size'),
	_peek = Symbol('peek'),
	_iter = Symbol('iter');

export default class IterExt {
	constructor(iterator, size = null) {
		switch ( Object.prototype.toString.call(iterator) ) {
			case '[object Array]':
				this[_size] = iterator.length;
				this[_iter] = iterator.entries();
				break;
			case '[object Map]':
				this[_size] = iterator.size;
				this[_iter] = iterator.entries();
				break;
			case '[object Set]':
				this[_size] = iterator.size;
				this[_iter] = iterator.entries();
				break;
			default:
				this[_size] = size;
				this[_iter] = iterator;
		}

		this[_peek] = null;
		this[_queue] = [];
	}

	next(...args) {
		if ( this[_peek] !== null ) {
			let entry = this[_peek];
			this[_peek] = null;
			return entry;
		} else {
			let entry = this[_iter].next(...args);

			if ( entry.done !== true ) {
				this[_queue].forEach(action => {
					entry = action(entry);
				});
			}

			return entry;
		}
	}

	count() {
		return this[_size];
	}

	map(fn) {
		if ( Object.prototype.toString.call(fn) === '[object Function]' ) {
			this[_queue].push(function(entry) {
				if ( entry.value !== undefined ) {
					entry.value[1] = fn(entry.value[1], entry.value[0]);
				}

				return entry;
			});
		} else {
			this[_queue].push(function(entry) {
				if ( entry.value !== undefined ) {
					if ( Object.prototype.toString.call(entry.value[1]) === '[object Map]' ) {
						entry.value[1] = entry.value[1].get(fn);
					} else {
						entry.value[1] = entry.value[1][fn];
					}
				}

				return entry;
			});
		}

		return this;
	}

	filter(fn) {
		this[_queue].push(function(entry) {
			if ( entry.value !== undefined && fn(entry.value[1], entry.value[0]) !== true ) {
				entry.value = undefined;
			}

			return entry;
		});

		return this;
	}

	peek() {
		this[_peek] = this.next();

		if ( this[_peek].value !== undefined ) {
			return this[_peek].value[1];
		}

		return null;
	}

	nth(n) {
		for ( let entry of this ) {
			if ( n === 0 ) {
				return (entry===undefined?null:entry[1]);
			}

			if ( entry !== undefined ) {
				n -= 1;
			}
		}

		return null;
	}

	skip(n = 1) {
		for ( let entry of this ) {
			if ( entry !== undefined ) {
				n -= 1;
			}

			if ( n === 0 ) {
				break;
			}

		}

		return this;
	}

	skip_while(fn) {
		for ( let entry of this ) {
			if ( entry !== undefined && fn(entry[1], entry[0]) !== true ) {
				break;
			}
		}

		return this;
	}

	take(n = 1) {
		let slice = [];

		for ( let entry of this ) {
			if ( entry !== undefined ) {
				slice.push(entry[1]);

				n -= 1;
			}

			if ( n === 0 ) {
				break;
			}

		}

		return new IterExt(slice);
	}

	take_while(fn) {
		let slice = [];

		for ( let entry of this ) {
			if ( entry !== undefined ) {
				if ( fn(entry[1], entry[0]) !== true ) {
					break;
				}

				slice.push(entry[1]);
			}
		}

		return new IterExt(slice);
	}

	fold(result, fn) {
		for ( let entry of this ) {
			if ( entry !== undefined ) {
				result = fn(result, entry[1], entry[0]);
			}
		}

		return result;
	}

	toArray() {
		let result = [];

		for ( let entry of this ) {
			if ( entry !== undefined ) {
				result.push(entry[1]);
			}
		}

		return result;
	}

	toMap(key = null) {
		let map = new Map();

		if ( key === null ) {
			for ( let entry of this ) {
				if ( entry !== undefined ) {
					map.set(entry[0], entry[1]);
				}
			}
		} else {
			for ( let entry of this ) {
				if ( entry !== undefined && entry[1].hasOwnProperty(key) ) {
					map.set(entry[1][key], entry[1]);
				}
			}
		}

		return map;
	}

	[Symbol.iterator]() {
		return this;
	}
}
