import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

export async function uploader(
  url: string,
  folder: string,
  index = 0,
): Promise<string> {
  const originalName = path.basename(url).split('?')[0];
  const ext = path.extname(originalName);
  const base = path.basename(originalName, ext);
  const uniqueName = `${base}-${index}${ext}`;
  const filePath = path.join(folder, uniqueName);

  const writer = fs.createWriteStream(filePath);

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(`/uploads/${uniqueName}`));
    writer.on('error', reject);
  });
}
