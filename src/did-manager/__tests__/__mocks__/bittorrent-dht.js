import { jest } from '@jest/globals';

// manual mock
const DHT = jest.fn(() => {
  return {
    put: jest.fn((opts, callback) => {
      callback(null, 'mocked-hash');
    }),
    get: jest.fn((key, callback) => {
      callback(null, Buffer.from('mocked-value'));
    }),
  };
});

export default DHT;
