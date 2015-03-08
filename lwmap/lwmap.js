'use strict';

let _m = Symbol('map');

export default class LwMap extends Map {
	constructor(...args) {
		this[_m] = new Map(...args);
	}

	get size() { return this[_m].size; }
	set(...args) { return this[_m].set(...args); }
	clear(...args) { return this[_m].clear(...args); }
	delete(...args) { return this[_m].delete(...args); }
	entries(...args) { return this[_m].entries(...args); }
	forEach(...args) { return this[_m].forEach(...args); }
	get(...args) { return this[_m].get(...args); }
	has(...args) { return this[_m].has(...args); }
	keys(...args) { return this[_m].keys(...args); }
	values(...args) { return this[_m].values(...args); }

	key(pos) {
		let index = 0;

		for ( let key of this[_m].keys() ) {
			if ( pos === index ) {
				return key;
			}

			index += 1;
		}
	}

	value(pos) {
		let index = 0;

		for ( let value of this[_m].values() ) {
			if ( pos === index ) {
				return value;
			}

			index += 1;
		}
	}

	entry(pos) {
		let index = 0;

		for ( let entry of this[_m].entries() ) {
			if ( pos === index ) {
				return entry;
			}

			index += 1;
		}
	}

	map(cb) {
		let result = new LwMap();

		this[_m].forEach(function(...args) {
			result.set(args[1], cb(...args));
		});

		return result;
	}

	reduce(cb, result) {
		this[_m].forEach(function(...args) {
			result = cb(result, ...args);
		});

		return result;
	}

	reduceRight(cb, result) {
		let keys = [];

		for ( let key of this[_m].keys() ) {
			keys.unshift(key);
		}

		keys.forEach((key) => {
			result = cb(result, this[_m].get(key), key, this[_m]);
		});

		return result;
	}

	filter(cb) {
		let result = new LwMap();

		this[_m].forEach(function(...args) {
			if (cb(...args)) {
				result.set(args[1], args[0]);
			}
		});

		return result;
	}

	some(cb) {
		for ( let item of this[_m].entries() ) {
			if ( cb(item[1], item[0], this[_m]) ) {
				return true;
			}
		}
		return false;
	}

	every(cb) {
		for ( let item of this[_m].entries() ) {
			if ( !cb(item[1], item[0], this[_m]) ) {
				return false;
			}
		}
		return true;
	}
}
