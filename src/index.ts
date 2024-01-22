import jsQR, { QRCode } from 'jsqr';
import { Point } from 'jsqr/dist/locator';

export function qrSanner(
  el: HTMLElement,
  option?: {
    onCancel(): void;
  }
) {
  return new Promise<string>(async resolve => {
    const { root, video, canvas } = createView(el);
    const camera = getCamera(video);
    await camera.start();
    const canvasTemp = document.createElement('canvas');
    canvasTemp.width = window.innerWidth;
    canvasTemp.height = window.innerHeight;
    const ctx = canvasTemp.getContext('2d')!;
    const cancel = loop(() => {
      if (!video.videoWidth || !video.videoHeight) return;
      const isWidth = video.videoWidth / video.videoHeight > canvas.width / canvas.height;
      if (isWidth) {
        const scaledWidth = video.videoHeight * (canvas.width / canvas.height);

        ctx.drawImage(
          video,
          (video.videoWidth - scaledWidth) / 2,
          0,
          scaledWidth,
          video.videoHeight,
          0,
          0,
          canvas.width,
          canvas.height
        );
      } else {
        const scaledHeight = video.videoWidth * (canvas.height / canvas.width);
        ctx.drawImage(
          video,
          0,
          (video.videoHeight - scaledHeight) / 2,
          video.videoWidth,
          scaledHeight,
          0,
          0,
          window.innerWidth,
          window.innerHeight
        );
      }

      const codes: QRCode[] = [];
      let code = jsQR(
        ctx.getImageData(0, 0, canvasTemp.width, canvasTemp.height).data,
        canvasTemp.width,
        canvasTemp.height
      ) as QRCode;
      if (!code) return;
      codes.push(code);
      camera.pause();
      cancel();

      while (true) {
        clearPolygon(ctx, code);
        code = jsQR(
          ctx.getImageData(0, 0, canvasTemp.width, canvasTemp.height).data,
          canvasTemp.width,
          canvasTemp.height
        ) as QRCode;

        if (!code) break;
        codes.push(code);
      }

      if (codes.length === 1) {
        resolve(codes[0].data);
      } else {
        codes.forEach(code => drawPoint(root, code, resolve));
      }
    });
  });
}

function createView(el: HTMLElement) {
  const root = document.createElement('div');
  root.style.cssText = 'position: fixed;left: 0;top: 0;width: 100vw;height: 100vh;z-index: 99999;';
  el.appendChild(root);
  const video = document.createElement('video');
  video.style.cssText = 'position: absolute;left: 0;top: 0;width: 100%;height: 100%;object-fit: cover;';
  root.appendChild(video);
  video.width = window.innerWidth;
  video.height = window.innerHeight;
  const canvas = document.createElement('canvas');
  canvas.style.cssText = 'position: absolute;left: 0;top: 0;width: 100%;height: 100%;';
  root.appendChild(canvas);
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  return { root, video, canvas };
}

const getCamera = (video: HTMLVideoElement) => {
  let stream: Promise<MediaStream> | null = null;
  const start = async () => {
    if (stream) return stream;
    video.play();
    stream = navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
    });
    video.srcObject = await stream;
    return stream;
  };
  const pause = async () => {
    video.pause();
    stream = null;
    ((video.srcObject || stream) as MediaStream)?.getTracks().forEach(t => t.stop());
  };
  return { start, pause };
};

function loop(cb: () => void) {
  let canceled = false;
  const _loop = () => {
    requestAnimationFrame(() => {
      if (canceled) return;
      cb();
      _loop();
    });
  };
  _loop();
  return () => (canceled = true);
}

function clearPolygon(
  ctx: CanvasRenderingContext2D,
  { location: { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner } }: QRCode
) {
  ctx.beginPath();
  ctx.moveTo(topLeftCorner.x, topLeftCorner.y);
  ctx.lineTo(topRightCorner.x, topRightCorner.y);
  ctx.lineTo(bottomRightCorner.x, bottomRightCorner.y);
  ctx.lineTo(bottomLeftCorner.x, bottomLeftCorner.y);
  ctx.lineTo(topLeftCorner.x, topLeftCorner.y);
  ctx.fillStyle = '#ffffff';
  ctx.fill();
}

function drawPoint(
  el: HTMLElement,
  { data, location: { topLeftCorner, topRightCorner, bottomRightCorner, bottomLeftCorner } }: QRCode,
  resolve: (data: string) => void
) {
  const [x, y] = calculateIntersection(topRightCorner, bottomLeftCorner, topLeftCorner, bottomRightCorner);
  const div = document.createElement('div');
  div.style.cssText = `position: absolute;left: ${x - 16}px;top: ${y - 16}px;width: 32px;height: 32px;border-radius: 16px;background: red;`;
  el.appendChild(div);
  div.onclick = () => resolve(data);
}

function calculateIntersection(a: Point, b: Point, c: Point, d: Point) {
  var h = (a.x - c.x) * (b.y - c.y) - (a.y - c.y) * (b.x - c.x);
  var i = (a.x - d.x) * (b.y - d.y) - (a.y - d.y) * (b.x - d.x);
  var j = (c.x - a.x) * (d.y - a.y) - (c.y - a.y) * (d.x - a.x);
  var l = j / (i - h);
  var dx = l * (b.x - a.x),
    dy = l * (b.y - a.y);

  return [a.x + dx, a.y + dy];
}
