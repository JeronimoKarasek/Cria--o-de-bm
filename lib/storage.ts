/**
 * Camada de Storage usando Supabase Storage.
 * Substitui o uso anterior de AWS S3.
 */
import { getSupabaseAdmin, STORAGE_BUCKET } from './supabase';

function sanitizeFileName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '_');
}

/**
 * Gera uma URL temporária assinada para upload direto do browser.
 * Retorna também o path interno onde o arquivo será salvo.
 */
export async function generatePresignedUploadUrl(
  fileName: string,
  _contentType: string,
  isPublic = false
) {
  const supabase = getSupabaseAdmin();
  const prefix = isPublic ? 'public' : 'private';
  const cloud_storage_path = `${prefix}/${Date.now()}-${sanitizeFileName(fileName)}`;

  // upsert: true permite que o mesmo path seja sobrescrito se necessário
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUploadUrl(cloud_storage_path);

  if (error || !data) {
    throw new Error(error?.message ?? 'Erro ao gerar URL de upload');
  }

  return {
    uploadUrl: data.signedUrl,
    token: data.token,
    cloud_storage_path,
  };
}

/**
 * Retorna URL pública (se bucket for público) ou signed URL (1h) caso contrário.
 */
export async function getFileUrl(cloud_storage_path: string, isPublic: boolean) {
  const supabase = getSupabaseAdmin();
  if (isPublic) {
    const { data } = supabase.storage
      .from(STORAGE_BUCKET)
      .getPublicUrl(cloud_storage_path);
    return data.publicUrl;
  }
  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .createSignedUrl(cloud_storage_path, 60 * 60);
  if (error || !data) {
    throw new Error(error?.message ?? 'Erro ao gerar URL');
  }
  return data.signedUrl;
}

export async function deleteFile(cloud_storage_path: string) {
  const supabase = getSupabaseAdmin();
  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .remove([cloud_storage_path]);
  if (error) throw new Error(error.message);
  return { success: true };
}

/**
 * Upload server-side direto (útil quando o backend já tem o buffer).
 */
export async function uploadServerSide(
  buffer: Buffer | Uint8Array,
  fileName: string,
  contentType: string,
  isPublic = false
) {
  const supabase = getSupabaseAdmin();
  const prefix = isPublic ? 'public' : 'private';
  const cloud_storage_path = `${prefix}/${Date.now()}-${sanitizeFileName(fileName)}`;

  const { error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(cloud_storage_path, buffer, { contentType, upsert: false });

  if (error) throw new Error(error.message);
  return { cloud_storage_path };
}
