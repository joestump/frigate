import { h, Fragment } from 'preact';
import ActivityIndicator from '../components/ActivityIndicator';
import Button from '../components/Button';
import Heading from '../components/Heading';
import Link from '../components/Link';
import { useMqtt } from '../api/mqtt';
import useSWR from 'swr';
import axios from 'axios';
import { Table, Tbody, Thead, Tr, Th, Td } from '../components/Table';
import { useCallback, useState } from 'preact/hooks';
import Dialog from '../components/Dialog';

const emptyObject = Object.freeze({});

export default function System() {
  const [state, setState] = useState({ showFfprobe: false, ffprobe: '' });
  const { data: config } = useSWR('config');

  const {
    value: { payload: stats },
  } = useMqtt('stats');
  const { data: initialStats } = useSWR('stats');

  const { cpu_usages, detectors, service = {}, detection_fps: _, ...cameras } = stats || initialStats || emptyObject;

  const detectorNames = Object.keys(detectors || emptyObject);
  const cameraNames = Object.keys(cameras || emptyObject);

  const handleCopyConfig = useCallback(() => {
    async function copy() {
      await window.navigator.clipboard.writeText(JSON.stringify(config, null, 2));
    }
    copy();
  }, [config]);

  const onHandleFfprobe = async (camera, e) => {
    if (e) {
      e.stopPropagation();
    }

    setState({ ...state, showFfprobe: true });
    let paths = '';
    config.cameras[camera].ffmpeg.inputs.forEach((input) => {
      if (paths) {
        paths += ',';
        paths += input.path;
      } else {
        paths = input.path;
      }
    });
    const response = await axios.get('ffprobe', {
      params: {
        paths,
      },
    });

    if (response.status === 200) {
      setState({ showFfprobe: true, ffprobe: JSON.stringify(response.data, null, 2) });
    } else {
      setState({ ...state, ffprobe: 'There was an error getting the ffprobe output.' });
    }
  };

  const onCopyFfprobe = async () => {
    await window.navigator.clipboard.writeText(JSON.stringify(state.ffprobe, null, 2));
    setState({ ...state, ffprobe: '', showFfprobe: false });
  };

  return (
    <div className="space-y-4 p-2 px-4">
      <Heading>
        System <span className="text-sm">{service.version}</span>
      </Heading>
      {state.showFfprobe && (
        <Dialog>
          <div className="p-4">
            <Heading size="lg">Ffprobe Output</Heading>
            {state.ffprobe != '' ? <p className="mb-2">{state.ffprobe}</p> : <ActivityIndicator />}
          </div>
          <div className="p-2 flex justify-start flex-row-reverse space-x-2">
            <Button className="ml-2" onClick={() => onCopyFfprobe()} type="text">
              Copy
            </Button>
            <Button
              className="ml-2"
              onClick={() => setState({ ...state, ffprobe: '', showFfprobe: false })}
              type="text"
            >
              Close
            </Button>
          </div>
        </Dialog>
      )}

      {!detectors ? (
        <div>
          <ActivityIndicator />
        </div>
      ) : (
        <Fragment>
          <Heading size="lg">Detectors</Heading>
          <div data-testid="detectors" className="grid grid-cols-1 3xl:grid-cols-3 md:grid-cols-2 gap-4">
            {detectorNames.map((detector) => (
              <div key={detector} className="dark:bg-gray-800 shadow-md hover:shadow-lg rounded-lg transition-shadow">
                <div className="text-lg flex justify-between p-4">{detector}</div>
                <div className="p-2">
                  <Table className="w-full">
                    <Thead>
                      <Tr>
                        <Th>P-ID</Th>
                        <Th>Detection Start</Th>
                        <Th>Inference Speed</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      <Tr>
                        <Td>{detectors[detector]['pid']}</Td>
                        <Td>{detectors[detector]['detection_start']}</Td>
                        <Td>{detectors[detector]['inference_speed']}</Td>
                      </Tr>
                    </Tbody>
                  </Table>
                </div>
              </div>
            ))}
          </div>

          <Heading size="lg">Cameras</Heading>
          <div data-testid="cameras" className="grid grid-cols-1 3xl:grid-cols-3 md:grid-cols-2 gap-4">
            {cameraNames.map((camera) => (
              <div key={camera} className="dark:bg-gray-800 shadow-md hover:shadow-lg rounded-lg transition-shadow">
                <div className="text-lg flex justify-between p-4">
                  <Link href={`/cameras/${camera}`}>{camera.replaceAll('_', ' ')}</Link>
                  <Button onClick={(e) => onHandleFfprobe(camera, e)}>ffprobe</Button>
                </div>
                <div className="p-2">
                  <Table className="w-full">
                    <Thead>
                      <Tr>
                        <Th>Process</Th>
                        <Th>P-ID</Th>
                        <Th>fps</Th>
                        <Th>Cpu %</Th>
                        <Th>Memory %</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      <Tr key="capture" index="0">
                        <Td>Capture</Td>
                        <Td>{cameras[camera]['capture_pid']}</Td>
                        <Td>{cameras[camera]['process_fps']}</Td>
                        <Td>{cpu_usages[cameras[camera]['capture_pid']]['cpu']}%</Td>
                        <Td>{cpu_usages[cameras[camera]['capture_pid']]['mem']}%</Td>
                      </Tr>
                      <Tr key="detect" index="1">
                        <Td>Detect</Td>
                        <Td>{cameras[camera]['pid']}</Td>
                        <Td>
                          {cameras[camera]['detection_fps']} ({cameras[camera]['skipped_fps']} skipped)
                        </Td>
                        <Td>{cpu_usages[cameras[camera]['pid']]['cpu']}%</Td>
                        <Td>{cpu_usages[cameras[camera]['pid']]['mem']}%</Td>
                      </Tr>
                      <Tr key="ffmpeg" index="2">
                        <Td>ffmpeg</Td>
                        <Td>{cameras[camera]['ffmpeg_pid']}</Td>
                        <Td>{cameras[camera]['camera_fps']}</Td>
                        <Td>{cpu_usages[cameras[camera]['ffmpeg_pid']]['cpu']}%</Td>
                        <Td>{cpu_usages[cameras[camera]['ffmpeg_pid']]['mem']}%</Td>
                      </Tr>
                    </Tbody>
                  </Table>
                </div>
              </div>
            ))}
          </div>

          <p>System stats update automatically every {config.mqtt.stats_interval} seconds.</p>
        </Fragment>
      )}

      <div className="relative">
        <Heading size="sm">Config</Heading>
        <Button className="absolute top-8 right-4" onClick={handleCopyConfig}>
          Copy to Clipboard
        </Button>
        <pre className="overflow-auto font-mono text-gray-900 dark:text-gray-100 rounded bg-gray-100 dark:bg-gray-800 p-2 max-h-96">
          {JSON.stringify(config, null, 2)}
        </pre>
      </div>
    </div>
  );
}
