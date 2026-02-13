import postgres from 'postgres';

const sql = postgres(process.env.POSTGRES_URL!, { ssl: 'require' });

export type WorkspaceCompanyProfile = {
  workspaceId: string;
  companyName: string;
  address: string;
  vatOrRegNumber: string;
  companyEmail: string;
  invoiceFooter: string;
  logoDataUrl: string | null;
};

type CompanyProfileRow = {
  workspace_id: string | null;
  company_name: string;
  address_line1: string | null;
  reg_code: string | null;
  vat_number: string | null;
  billing_email: string | null;
  invoice_footer: string | null;
  logo_url: string | null;
};

function emptyProfile(workspaceId: string): WorkspaceCompanyProfile {
  return {
    workspaceId,
    companyName: '',
    address: '',
    vatOrRegNumber: '',
    companyEmail: '',
    invoiceFooter: '',
    logoDataUrl: null,
  };
}

function toProfile(workspaceId: string, row?: CompanyProfileRow): WorkspaceCompanyProfile {
  if (!row) {
    return emptyProfile(workspaceId);
  }

  const vatOrRegNumber = [row.vat_number?.trim(), row.reg_code?.trim()]
    .filter(Boolean)
    .join(' / ');

  return {
    workspaceId,
    companyName: row.company_name ?? '',
    address: row.address_line1 ?? '',
    vatOrRegNumber,
    companyEmail: row.billing_email ?? '',
    invoiceFooter: row.invoice_footer ?? '',
    logoDataUrl: row.logo_url ?? null,
  };
}

function normalizeEmail(email: string) {
  return email.trim().toLowerCase();
}

function optionalText(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function requireText(value: unknown, fieldName: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new Error(fieldName);
  }
  return value.trim();
}

function ensureEmail(value: unknown, fieldName: string): string | null {
  const text = optionalText(value);
  if (!text) return null;
  if (!/^\S+@\S+\.\S+$/.test(text)) {
    throw new Error(fieldName);
  }
  return normalizeEmail(text);
}

async function fetchWorkspaceOwnerMeta(
  workspaceId: string,
): Promise<{ ownerEmail: string; workspaceName: string }> {
  const [row] = await sql<{ owner_email: string; workspace_name: string }[]>`
    select
      u.email as owner_email,
      w.name as workspace_name
    from public.workspaces w
    join public.users u on u.id = w.owner_user_id
    where w.id = ${workspaceId}
    limit 1
  `;

  if (!row?.owner_email || !row.workspace_name) {
    throw new Error('workspace');
  }

  return {
    ownerEmail: normalizeEmail(row.owner_email),
    workspaceName: row.workspace_name,
  };
}

export async function fetchCompanyProfileForWorkspace(
  workspaceId: string,
): Promise<WorkspaceCompanyProfile> {
  const [row] = await sql<CompanyProfileRow[]>`
    select
      workspace_id,
      company_name,
      address_line1,
      reg_code,
      vat_number,
      billing_email,
      invoice_footer,
      logo_url
    from public.company_profiles
    where workspace_id = ${workspaceId}
    limit 1
  `;

  return toProfile(workspaceId, row);
}

export async function upsertCompanyProfileForWorkspace(input: {
  workspaceId: string;
  companyName: unknown;
  address: unknown;
  vatOrRegNumber: unknown;
  companyEmail: unknown;
  invoiceFooter: unknown;
}): Promise<WorkspaceCompanyProfile> {
  const companyName = requireText(input.companyName, 'companyName');
  const address = optionalText(input.address);
  const vatOrRegNumber = optionalText(input.vatOrRegNumber);
  const companyEmail = ensureEmail(input.companyEmail, 'companyEmail');
  const invoiceFooter = optionalText(input.invoiceFooter);
  const ownerMeta = await fetchWorkspaceOwnerMeta(input.workspaceId);

  await sql`
    insert into public.company_profiles (
      workspace_id,
      user_email,
      company_name,
      address_line1,
      reg_code,
      vat_number,
      billing_email,
      invoice_footer,
      updated_at
    )
    values (
      ${input.workspaceId},
      ${ownerMeta.ownerEmail},
      ${companyName},
      ${address},
      ${vatOrRegNumber},
      ${vatOrRegNumber},
      ${companyEmail},
      ${invoiceFooter},
      now()
    )
    on conflict (workspace_id)
    do update set
      user_email = excluded.user_email,
      company_name = excluded.company_name,
      address_line1 = excluded.address_line1,
      reg_code = excluded.reg_code,
      vat_number = excluded.vat_number,
      billing_email = excluded.billing_email,
      invoice_footer = excluded.invoice_footer,
      updated_at = now()
  `;

  return fetchCompanyProfileForWorkspace(input.workspaceId);
}

export async function setCompanyProfileLogo(input: {
  workspaceId: string;
  logoDataUrl: string;
}): Promise<void> {
  const ownerMeta = await fetchWorkspaceOwnerMeta(input.workspaceId);

  await sql`
    insert into public.company_profiles (
      workspace_id,
      user_email,
      company_name,
      logo_url,
      updated_at
    )
    values (
      ${input.workspaceId},
      ${ownerMeta.ownerEmail},
      ${ownerMeta.workspaceName},
      ${input.logoDataUrl},
      now()
    )
    on conflict (workspace_id)
    do update set
      user_email = excluded.user_email,
      logo_url = excluded.logo_url,
      updated_at = now()
  `;
}

export async function clearCompanyProfileLogo(workspaceId: string): Promise<void> {
  await sql`
    update public.company_profiles
    set logo_url = null,
        updated_at = now()
    where workspace_id = ${workspaceId}
  `;
}
