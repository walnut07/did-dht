import { jest } from '@jest/globals';

// manual mock
const DHT = jest.fn(() => {
  return {
    put: (opts, callback) => {
      callback(null, 'mocked-hash');
    },
    get: (key, callback) => {
      callback(null, Buffer.from('mocked-value'));
    },
  };
});

export default DHT;
