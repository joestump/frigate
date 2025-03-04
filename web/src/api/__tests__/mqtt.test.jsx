import { h } from 'preact';
import { Mqtt, MqttProvider, useMqtt } from '../mqtt';
import { useCallback, useContext } from 'preact/hooks';
import { fireEvent, render, screen } from 'testing-library';

function Test() {
  const { state } = useContext(Mqtt);
  return state.__connected ? (
    <div data-testid="data">
      {Object.keys(state).map((key) => (
        <div key={key} data-testid={key}>
          {JSON.stringify(state[key])}
        </div>
      ))}
    </div>
  ) : null;
}

const TEST_URL = 'ws://test-foo:1234/ws';

describe('MqttProvider', () => {
  let createWebsocket, wsClient;
  beforeEach(() => {
    wsClient = {
      close: vi.fn(),
      send: vi.fn(),
    };
    createWebsocket = vi.fn((url) => {
      wsClient.args = [url];
      return new Proxy(
        {},
        {
          get(_target, prop, _receiver) {
            return wsClient[prop];
          },
          set(_target, prop, value) {
            wsClient[prop] = typeof value === 'function' ? vi.fn(value) : value;
            if (prop === 'onopen') {
              wsClient[prop]();
            }
            return true;
          },
        }
      );
    });
  });

  test('connects to the mqtt server', async () => {
    render(
      <MqttProvider config={mockConfig} createWebsocket={createWebsocket} mqttUrl={TEST_URL}>
        <Test />
      </MqttProvider>
    );
    await screen.findByTestId('data');
    expect(wsClient.args).toEqual([TEST_URL]);
    expect(screen.getByTestId('__connected')).toHaveTextContent('true');
  });

  test('receives data through useMqtt', async () => {
    function Test() {
      const {
        value: { payload, retain },
        connected,
      } = useMqtt('tacos');
      return connected ? (
        <div>
          <div data-testid="payload">{JSON.stringify(payload)}</div>
          <div data-testid="retain">{JSON.stringify(retain)}</div>
        </div>
      ) : null;
    }

    const { rerender } = render(
      <MqttProvider config={mockConfig} createWebsocket={createWebsocket} mqttUrl={TEST_URL}>
        <Test />
      </MqttProvider>
    );
    await screen.findByTestId('payload');
    wsClient.onmessage({
      data: JSON.stringify({ topic: 'tacos', payload: JSON.stringify({ yes: true }), retain: false }),
    });
    rerender(
      <MqttProvider config={mockConfig} createWebsocket={createWebsocket} mqttUrl={TEST_URL}>
        <Test />
      </MqttProvider>
    );
    expect(screen.getByTestId('payload')).toHaveTextContent('{"yes":true}');
    expect(screen.getByTestId('retain')).toHaveTextContent('false');
  });

  test('can send values through useMqtt', async () => {
    function Test() {
      const { send, connected } = useMqtt('tacos');
      const handleClick = useCallback(() => {
        send({ yes: true });
      }, [send]);
      return connected ? <button onClick={handleClick}>click me</button> : null;
    }

    render(
      <MqttProvider config={mockConfig} createWebsocket={createWebsocket} mqttUrl={TEST_URL}>
        <Test />
      </MqttProvider>
    );
    await screen.findByRole('button');
    fireEvent.click(screen.getByRole('button'));
    await expect(wsClient.send).toHaveBeenCalledWith(
      JSON.stringify({ topic: 'tacos', payload: JSON.stringify({ yes: true }), retain: false })
    );
  });

  test('prefills the recordings/detect/snapshots state from config', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(123456);
    const config = {
      cameras: {
        front: { name: 'front', detect: { enabled: true }, record: { enabled: false }, snapshots: { enabled: true } },
        side: { name: 'side', detect: { enabled: false }, record: { enabled: false }, snapshots: { enabled: false } },
      },
    };
    render(
      <MqttProvider config={config} createWebsocket={createWebsocket} mqttUrl={TEST_URL}>
        <Test />
      </MqttProvider>
    );
    await screen.findByTestId('data');
    expect(screen.getByTestId('front/detect/state')).toHaveTextContent(
      '{"lastUpdate":123456,"payload":"ON","retain":false}'
    );
    expect(screen.getByTestId('front/recordings/state')).toHaveTextContent(
      '{"lastUpdate":123456,"payload":"OFF","retain":false}'
    );
    expect(screen.getByTestId('front/snapshots/state')).toHaveTextContent(
      '{"lastUpdate":123456,"payload":"ON","retain":false}'
    );
    expect(screen.getByTestId('side/detect/state')).toHaveTextContent(
      '{"lastUpdate":123456,"payload":"OFF","retain":false}'
    );
    expect(screen.getByTestId('side/recordings/state')).toHaveTextContent(
      '{"lastUpdate":123456,"payload":"OFF","retain":false}'
    );
    expect(screen.getByTestId('side/snapshots/state')).toHaveTextContent(
      '{"lastUpdate":123456,"payload":"OFF","retain":false}'
    );
  });
});

const mockConfig = {
  cameras: {},
};
