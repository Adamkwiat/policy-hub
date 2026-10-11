import { supabase } from './supabase'

// Used until supabase/007_policy_folders.sql has been run, and as the starting folders
export const DEFAULT_FOLDERS = ['Clinical', 'HR', 'Health & Safety', 'Information Governance', 'Safeguarding', 'Complaints', 'Other']

export async function fetchFolders() {
  const { data, error } = await supabase.from('policy_folders').select('name').order('name')
  if (error || !data || data.length === 0) return { folders: DEFAULT_FOLDERS, editable: false }
  return { folders: data.map(f => f.name as string), editable: true }
}
