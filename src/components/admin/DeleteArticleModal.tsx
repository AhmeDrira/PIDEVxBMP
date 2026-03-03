import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { Button } from '../ui/button';

interface DeleteArticleModalProps {
  isOpen: boolean;
  articleTitle: string;
  onClose: () => void;
  onConfirm: () => void;
}

export default function DeleteArticleModal({ 
  isOpen, 
  articleTitle, 
  onClose, 
  onConfirm 
}: DeleteArticleModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-8">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center mb-4">
            <AlertTriangle size={32} className="text-red-600" />
          </div>
          
          <h2 className="text-2xl font-bold mb-2" style={{ color: '#111827' }}>
            Delete Article?
          </h2>
          
          <p className="mb-2" style={{ color: '#6B7280' }}>
            This action cannot be undone. The article
          </p>
          <p className="font-semibold mb-2" style={{ color: '#111827' }}>
            "{articleTitle}"
          </p>
          <p className="mb-6" style={{ color: '#6B7280' }}>
            will be permanently removed.
          </p>

          <div className="flex gap-3 w-full">
            <Button
              onClick={onClose}
              variant="outline"
              className="flex-1 h-11 rounded-xl border-2"
            >
              Cancel
            </Button>
            <Button
              onClick={onConfirm}
              className="flex-1 h-11 rounded-xl text-white bg-red-600 hover:bg-red-700"
            >
              Delete
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
