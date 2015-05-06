'use strict';

let _queue = Symbol('queue'),
	_peek = Symbol('peek'),
	_iter = Symbol('iter');

export default class IterExt {
	constructor(iterator) {
		switch ( Object.prototype.toString.call(iterator) ) {
			case '[object Array]':
				this[_iter] = iterator.entries();
				break;
			case '[object Map]':
				this[_iter] = iterator.entries();
				break;
			case '[object Set]':
				this[_iter] = iterator.entries();
				break;
			default:
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
				for ( let action of this[_queue] ) {
					entry = action(entry);
				}
			}

			return entry;
		}
	}

	map(fn) {
		this[_queue].push(entry => {
			if ( entry.value !== undefined ) {
				entry.value[1] = fn(entry.value[1], entry.value[0]);
			}

			return entry;
		});

		return this;
	}

	filter(fn) {
		this[_queue].push(entry => {
			if ( entry.value !== undefined && fn(entry.value[1], entry.value[0]) !== true ) {
				entry.value = undefined;
			}

			return entry;
		});

		return this;
	}

	filter_map(fn) {
		if ( Object.prototype.toString.call(fn) === '[object Function]' ) {
			this[_queue].push(entry => {
				if ( entry.value !== undefined ) {
					entry.value[1] = fn(entry.value[1], entry.value[0]);

					if ( entry.value[1] === null ) {
						entry.value = undefined;
					}
				}

				return entry;
			});
		} else {
			this[_queue].push(entry => {
				if ( entry.value !== undefined ) {
					if ( Object.prototype.toString.call(entry.value[1]) === '[object Map]' ) {
						if ( entry.value[1].has(fn) ) {
							entry.value[1] = entry.value[1].get(fn);
						} else {
							entry.value = undefined;
						}
					} else {
						if ( entry.value[1].hasOwnProperty(fn) ) {
							entry.value[1] = entry.value[1][fn];
						} else {
							entry.value = undefined;
						}
					}
				}

				return entry;
			});
		}

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
			if ( entry !== undefined ) {
				if ( n === 0 ) {
					return entry[1];
				} else {
					n -= 1;
				}
			}
		}

		return null;
	}

	skip(n = 1) {
		this.filter(() => {
			if ( n > 0 ) {
				n -= 1;
				return false;
			} else {
				return true;
			}
		});

		return this;
	}

	skip_while(fn) {
		this.filter((item, index) => {
			return !fn(item, index);
		});

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
