import React from 'react';
import { TableRow, TableCell } from '../../ui/table';

const EmptyState = ({ message, colSpan }) => {
  return (
    <TableRow>
      <TableCell
        colSpan={colSpan ?? 6}
        className="text-center py-10 text-text-muted text-sm"
      >
        {message ?? 'No records found.'}
      </TableCell>
    </TableRow>
  );
};

export default EmptyState;
