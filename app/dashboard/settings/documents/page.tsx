import { Metadata } from 'next';
import DocumentsSettingsPanel from './documents-settings-panel';

export const metadata: Metadata = {
  title: 'Documents Settings',
};

export default function DocumentsSettingsPage() {
  return <DocumentsSettingsPanel />;
}
