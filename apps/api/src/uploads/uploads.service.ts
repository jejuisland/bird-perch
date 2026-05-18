import { BadRequestException, Injectable, InternalServerErrorException } from '@nestjs/common';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { v4 as uuidv4 } from 'uuid';
import * as ws from 'ws';

@Injectable()
export class UploadsService {
  private _client: SupabaseClient | null = null;
  private bucket: string;

  constructor() {
    this.bucket = process.env.SUPABASE_STORAGE_BUCKET || 'parking-photos';
  }

  private get client(): SupabaseClient {
    if (this._client) return this._client;
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) {
      throw new InternalServerErrorException('Photo uploads are not configured (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing)');
    }
    this._client = createClient(url, key, {
      auth: { persistSession: false },
      realtime: { transport: ((ws as any).WebSocket ?? (ws as any)) as any },
    });
    return this._client;
  }

  async createSignedParkingPhotoUpload(args: {
    userId: string;
    contentType: string;
    fileExt?: string;
  }): Promise<{ uploadUrl: string; storagePath: string; publicUrl: string; expiresAt: string }> {
    const { userId, contentType, fileExt } = args;
    if (!contentType) throw new BadRequestException('contentType is required');

    const safeExt = (fileExt || contentType.split('/')[1] || 'jpg').replace(/[^a-z0-9]/gi, '').toLowerCase();
    const storagePath = `parking-photos/${userId}/${uuidv4()}.${safeExt}`;

    const { data, error } = await this.client.storage
      .from(this.bucket)
      // 10 minutes
      .createSignedUploadUrl(storagePath);

    if (error || !data) {
      throw new InternalServerErrorException('Failed to create upload URL');
    }

    const { data: publicData } = this.client.storage.from(this.bucket).getPublicUrl(storagePath);

    const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();

    return {
      uploadUrl: data.signedUrl,
      storagePath,
      publicUrl: publicData.publicUrl,
      expiresAt,
    };
  }

  getPublicUrl(storagePath: string): string {
    const { data } = this.client.storage.from(this.bucket).getPublicUrl(storagePath);
    return data.publicUrl;
  }
}

