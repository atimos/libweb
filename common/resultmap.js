'use strict';

let _map = '_map_';

export default class ResultMap {
	constructor(...args) {
		this[_map] = new window.Map(...args);
	}

	get size() { return this[_map].size; }
	clear(...args) { return this[_map].clear(...args); }
	delete(...args) { return this[_map].delete(...args); }
	entries(...args) { return this[_map].entries(...args); }
	forEach(...args) { return this[_map].forEach(...args); }
	get(...args) { return this[_map].get(...args); }
	has(...args) { return this[_map].has(...args); }
	keys(...args) { return this[_map].keys(...args); }
	set(...args) { return this[_map].set(...args); }
	values(...args) { return this[_map].values(...args); }

	map(cb) {
		let result = new ResultMap();

		this[_map].forEach(function(...args) {
			result.set(args[1], cb(...args));
		});

		return result;
	}

	reduce(cb, result) {
		this[_map].forEach(function(...args) {
			result = cb(result, ...args);
		});

		return result;
	}

	reduceRight(cb, result) {
		let keys = [];

		for ( let key of this[_map].keys() ) {
			keys.unshift(key);
		}

		keys.forEach((key) => {
			result = cb(result, this[_map].get(key), key, this[_map]);
		});

		return result;
	}

	filter(cb) {
		let result = new ResultMap();

		this[_map].forEach(function(...args) {
			if (cb(...args)) {
				result.set(args[1], args[0]);
			}
		});

		return result;
	}

	some(cb) {
		for ( let item of this[_map].entries() ) {
			if ( cb(item[1], item[0], this[_map]) ) {
				return true;
			}
		}
		return false;
	}

	every(cb) {
		for ( let item of this[_map].entries() ) {
			if ( !cb(item[1], item[0], this[_map]) ) {
				return false;
			}
		}
		return true;
	}
}
