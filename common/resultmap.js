let map = window.Symbol('entries');

export default class ResultMap {
	constructor(...args) {
		this[map] = new window.Map(...args);
	}

	get size() { return this[map].size; }
	clear(...args) { return this[map].clear(...args); }
	delete(...args) { return this[map].delete(...args); }
	entries(...args) { return this[map].entries(...args); }
	forEach(...args) { return this[map].forEach(...args); }
	get(...args) { return this[map].get(...args); }
	has(...args) { return this[map].has(...args); }
	keys(...args) { return this[map].keys(...args); }
	set(...args) { return this[map].set(...args); }
	values(...args) { return this[map].values(...args); }

	map(cb) {
		let result = new ResultMap();

		this[map].forEach(function(...args) {
			result.set(args[1], cb(...args));
		});

		return result;
	}

	reduce(cb, result) {
		this[map].forEach(function(...args) {
			result = cb(result, ...args);
		});

		return result;
	}

	reduceRight(cb, result) {
		let keys = [];

		for ( let key of this[map].keys() ) {
			keys.unshift(key);
		}

		keys.forEach((key) => {
			result = cb(result, this[map].get(key), key, this[map]);
		});

		return result;
	}

	filter(cb) {
		let result = new ResultMap();

		this[map].forEach(function(...args) {
			if (cb(...args)) {
				result.set(args[1], args[0]);
			}
		});

		return result;
	}

	some(cb) {
		for ( let item of this[map].entries() ) {
			if ( cb(item[1], item[0], this[map]) ) {
				return true;
			}
		}
		return false;
	}

	every(cb) {
		for ( let item of this[map].entries() ) {
			if ( !cb(item[1], item[0], this[map]) ) {
				return false;
			}
		}
		return true;
	}
}
