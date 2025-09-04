import React, { useState } from 'react';
import { Globe, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useAuth } from '@/contexts/AuthContext';
import { apiService } from '@/services/api';
import { useToast } from '@/hooks/use-toast';

const languages = [
  { code: 'en', name: 'English', native: 'English' },
  { code: 'hi', name: 'Hindi', native: 'हिंदी' },
  { code: 'mr', name: 'Marathi', native: 'मराठी' },
  { code: 'es', name: 'Spanish', native: 'Español' },
  { code: 'fr', name: 'French', native: 'Français' },
  { code: 'pt', name: 'Portuguese', native: 'Português' },
  { code: 'zh', name: 'Chinese', native: '中文' },
  { code: 'ja', name: 'Japanese', native: '日本語' },
  { code: 'ko', name: 'Korean', native: '한국어' },
  { code: 'ar', name: 'Arabic', native: 'العربية' },
  { code: 'de', name: 'German', native: 'Deutsch' },
  { code: 'ru', name: 'Russian', native: 'Русский' },
  { code: 'it', name: 'Italian', native: 'Italiano' },
];

interface LanguageSettingsProps {
  onClose?: () => void;
}

export default function LanguageSettings({ onClose }: LanguageSettingsProps) {
  const { user, updateUser } = useAuth();
  const { toast } = useToast();
  const [selectedLanguage, setSelectedLanguage] = useState(user?.preferredLanguage || 'en');
  const [isUpdating, setIsUpdating] = useState(false);

  const handleLanguageUpdate = async () => {
    if (!user || selectedLanguage === user.preferredLanguage) return;

    setIsUpdating(true);
    try {
      await apiService.updateProfile({ preferredLanguage: selectedLanguage });
      
      // Update user context
      updateUser({ ...user, preferredLanguage: selectedLanguage });
      
      toast({
        title: 'Language Updated',
        description: `Your preferred language has been changed to ${getLanguageName(selectedLanguage)}.`,
      });

      if (onClose) onClose();
    } catch (error) {
      console.error('Failed to update language:', error);
      toast({
        title: 'Error',
        description: 'Failed to update language preference. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const getLanguageName = (code: string) => {
    return languages.find(lang => lang.code === code)?.native || code;
  };

  const getCurrentLanguage = () => {
    return languages.find(lang => lang.code === (user?.preferredLanguage || 'en'));
  };

  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="flex items-center space-x-2">
          <Globe className="h-5 w-5" />
          <span>Language Settings</span>
        </CardTitle>
        <CardDescription>
          Choose your preferred language for automatic message translation
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Language */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Current Language
          </label>
          <div className="flex items-center space-x-2 p-3 bg-muted/50 rounded-lg">
            <Globe className="h-4 w-4 text-primary" />
            <span className="font-medium">
              {getCurrentLanguage()?.native} ({getCurrentLanguage()?.name})
            </span>
          </div>
        </div>

        {/* Language Selection */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Select New Language
          </label>
          <Select value={selectedLanguage} onValueChange={setSelectedLanguage}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {languages.map((language) => (
                <SelectItem key={language.code} value={language.code}>
                  <div className="flex items-center space-x-2">
                    <span>{language.native}</span>
                    <span className="text-muted-foreground">({language.name})</span>
                    {language.code === user?.preferredLanguage && (
                      <Check className="h-4 w-4 text-primary ml-auto" />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Translation Info */}
        <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg border border-blue-200 dark:border-blue-800">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            <Globe className="h-4 w-4 inline mr-1" />
            All incoming messages will be automatically translated to your preferred language.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex space-x-3">
          <Button
            onClick={handleLanguageUpdate}
            disabled={isUpdating || selectedLanguage === user?.preferredLanguage}
            className="flex-1"
          >
            {isUpdating ? 'Updating...' : 'Update Language'}
          </Button>
          {onClose && (
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
