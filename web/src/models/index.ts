import mongoose, { Schema, Document } from 'mongoose';

export interface IMapel extends Document {
  name: string;
  createdAt: Date;
}

export interface IBab extends Document {
  mapelId: mongoose.Types.ObjectId;
  name: string;
  createdAt: Date;
}

export interface IMateri extends Document {
  mapelId: mongoose.Types.ObjectId;
  babId: mongoose.Types.ObjectId;
  name: string;
  type: string; // 'file', 'youtube'
  mimeType?: string;
  filePath?: string; // for local file storage
  url?: string; // for youtube links
  extractedText?: string; // pre-extracted text/transcript
  createdAt: Date;
}

const MapelSchema: Schema = new Schema({
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const BabSchema: Schema = new Schema({
  mapelId: { type: Schema.Types.ObjectId, ref: 'Mapel', required: true },
  name: { type: String, required: true },
  createdAt: { type: Date, default: Date.now },
});

const MateriSchema: Schema = new Schema({
  mapelId: { type: Schema.Types.ObjectId, ref: 'Mapel', required: true },
  babId: { type: Schema.Types.ObjectId, ref: 'Bab', required: true },
  name: { type: String, required: true },
  type: { type: String, required: true },
  mimeType: { type: String },
  filePath: { type: String },
  url: { type: String },
  extractedText: { type: String },
  createdAt: { type: Date, default: Date.now },
});

// Prevent HMR from caching old schemas
if (process.env.NODE_ENV !== 'production') {
  delete mongoose.models.Mapel;
  delete mongoose.models.Bab;
  delete mongoose.models.Materi;
}

export const Mapel = mongoose.models.Mapel || mongoose.model<IMapel>('Mapel', MapelSchema);
export const Bab = mongoose.models.Bab || mongoose.model<IBab>('Bab', BabSchema);
export const Materi = mongoose.models.Materi || mongoose.model<IMateri>('Materi', MateriSchema);
