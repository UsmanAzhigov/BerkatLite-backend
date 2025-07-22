import * as fs from 'fs';
import * as path from 'path';
import axios from 'axios';

export async function uploader(url: string, folder: string): Promise<string> {
  const fileName = path.basename(url).split('?')[0];
  const filePath = path.join(folder, fileName);

  const writer = fs.createWriteStream(filePath);

  const response = await axios({
    url,
    method: 'GET',
    responseType: 'stream',
  });

  response.data.pipe(writer);

  return new Promise((resolve, reject) => {
    writer.on('finish', () => resolve(`/uploads/${fileName}`));
    writer.on('error', reject);
  });
}
