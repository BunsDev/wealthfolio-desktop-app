import { getAccounts } from '@/commands/account';
import { getActivities } from '@/commands/activity';
import { getGoals } from '@/commands/goal';
import { getAccountsHistory } from '@/commands/portfolio';
import {
  Account,
  ActivityDetails,
  ExportDataType,
  ExportedFileFormat,
  PortfolioHistory,
  Goal,
} from '@/lib/types';
import { useQuery } from '@tanstack/react-query';
import { writeBinaryFile, BaseDirectory } from '@tauri-apps/api/fs';
import { save } from '@tauri-apps/api/dialog';
import { QueryKeys } from './query-keys';

interface ExportParms {
  format: ExportedFileFormat;
  data: ExportDataType;
}

export function useExportData() {
  const { refetch: fetchAccounts } = useQuery<Account[], Error>({
    queryKey: [QueryKeys.ACCOUNTS],
    queryFn: getAccounts,
    enabled: false,
  });
  const { refetch: fetchActivities } = useQuery<ActivityDetails[], Error>({
    queryKey: [QueryKeys.ACTIVITIES],
    queryFn: getActivities,
    enabled: false,
  });
  const { refetch: fetchGoals } = useQuery<Goal[], Error>({
    queryKey: [QueryKeys.GOALS],
    queryFn: getGoals,
    enabled: false,
  });
  const { refetch: fetchPortfolioHistory } = useQuery<PortfolioHistory[], Error>({
    queryKey: [QueryKeys.ALL_ACCOUNTS_HISTORY],
    queryFn: getAccountsHistory,
    enabled: false,
  });

  async function exportData({
    params,
    onSuccess,
    onError,
  }: {
    params: ExportParms;
    onSuccess: Function;
    onError: Function;
  }) {
    try {
      const { format, data: disiredData } = params;
      if (format === 'SQLite') {
        const sqliteFile = await generateSQLiteFile();
        downloadFileFromContent(sqliteFile, 'data.sqlite');
      } else {
        let haveDownloaded = false;
        switch (disiredData) {
          case 'accounts': {
            const accountsData = await fetchAndConvertData(fetchAccounts, format);
            haveDownloaded = await downloadFileFromContent(
              accountsData,
              'accounts.' + format.toLowerCase(),
            );
            break;
          }
          case 'activities': {
            const activitiesData = await fetchAndConvertData(fetchActivities, format);
            haveDownloaded = await downloadFileFromContent(
              activitiesData,
              'activities.' + format.toLowerCase(),
            );
            break;
          }
          case 'goals': {
            const goalsData = await fetchAndConvertData(fetchGoals, format);
            haveDownloaded = await downloadFileFromContent(
              goalsData,
              'goals.' + format.toLowerCase(),
            );
            break;
          }
          case 'portfolio-history': {
            const portfolioHistoryData = await fetchAndConvertData(fetchPortfolioHistory, format);
            haveDownloaded = await downloadFileFromContent(
              portfolioHistoryData,
              'portfolio-history.' + format.toLowerCase(),
            );
            break;
          }
        }
        haveDownloaded && onSuccess();
      }
    } catch (error) {
      console.log('Error while exporting', error);
      onError();
    }
  }

  return { exportData };
}

// TODO
async function generateSQLiteFile() {
  return '';
}

async function fetchAndConvertData(
  queryFn: () => Promise<any>,
  format: ExportedFileFormat,
): Promise<string> {
  const response = await queryFn();
  return formatData(response.data, format);
}

function formatData(data: any, format: string): string {
  if (!data || data.length === 0) return '';
  if (format === 'CSV') {
    return convertToCSV(data);
  } else if (format === 'JSON') {
    return JSON.stringify(data, null, 2);
  }
  return '';
}

function convertToCSV(data: any) {
  const array = [Object.keys(data[0])].concat(data);
  return array
    .map((row) => {
      return Object.values(row)
        .map((value) => {
          return typeof value === 'string' ? JSON.stringify(value) : value;
        })
        .toString();
    })
    .join('\n');
}

export async function downloadFileFromContent(fileContent: string | Blob, fileName: string) {
  const filePath = await save({
    defaultPath: fileName,
    filters: [
      {
        name: fileName,
        extensions: [fileName.split('.').pop() ?? ''],
      },
    ],
  });

  if (filePath === null) {
    return false;
  }

  let contentTosave: string | Uint8Array;
  if (typeof fileContent === 'string') {
    contentTosave = new TextEncoder().encode(fileContent);
  } else {
    const arrayBuffer = await fileContent.arrayBuffer();
    contentTosave = new Uint8Array(arrayBuffer);
  }

  await writeBinaryFile(
    { path: filePath, contents: contentTosave },
    { dir: BaseDirectory.Document },
  );

  return true;
}