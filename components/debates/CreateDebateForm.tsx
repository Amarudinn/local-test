'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePrivy } from '@privy-io/react-auth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { deployDebateContract } from '@/lib/genlayer-client';
import { supabaseApi } from '@/lib/supabase-client';
import { useGenLayerSigner } from '@/lib/hooks/useGenLayerSigner';
import {
  DURATION_OPTIONS,
  durationToHours,
  durationToMinutes,
  VALIDATION,
  PARTICIPANT_OPTIONS,
  DEFAULT_MAX_PARTICIPANTS,
  DEFAULT_EVALUATION_CRITERIA,
  type CreateDebateFormData,
  type EvaluationCriteria
} from '@/lib/types';
import { Switch } from '@/components/ui/switch';
import { logger, LogCategory } from '@/lib/logger';
import { toast } from '@/lib/toast';

interface CreateDebateFormProps {
  onSuccess?: (contractAddress: string) => void;
  onCancel?: () => void;
}

export function CreateDebateForm({ onSuccess, onCancel }: CreateDebateFormProps) {
  const router = useRouter();
  const { authenticated, user } = usePrivy();
  const { ready: signerReady, client, walletAddress } = useGenLayerSigner();

  // Form state
  const [formData, setFormData] = useState<CreateDebateFormData>({
    topic: '',
    description: '',
    duration: '24h', // Default to 24 hours
  });

  // Custom participants state
  const [useCustomParticipants, setUseCustomParticipants] = useState(false);
  const [maxParticipants, setMaxParticipants] = useState(DEFAULT_MAX_PARTICIPANTS);

  // Custom evaluation criteria state
  const [useCustomCriteria, setUseCustomCriteria] = useState(false);
  const [criteria, setCriteria] = useState<EvaluationCriteria>({ ...DEFAULT_EVALUATION_CRITERIA });

  // UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof CreateDebateFormData, string>>>({});
  const [generalError, setGeneralError] = useState<string>('');

  /**
   * Validate form data
   * Returns true if valid, false otherwise
   */
  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof CreateDebateFormData, string>> = {};

    // Validate topic
    if (!formData.topic.trim()) {
      newErrors.topic = 'Topic is required';
    } else if (formData.topic.length < VALIDATION.TOPIC_MIN_LENGTH) {
      newErrors.topic = `Topic must be at least ${VALIDATION.TOPIC_MIN_LENGTH} character`;
    } else if (formData.topic.length > VALIDATION.TOPIC_MAX_LENGTH) {
      newErrors.topic = `Topic must be ${VALIDATION.TOPIC_MAX_LENGTH} characters or less`;
    }

    // Validate description
    if (!formData.description.trim()) {
      newErrors.description = 'Description is required';
    } else if (formData.description.length < VALIDATION.DESCRIPTION_MIN_LENGTH) {
      newErrors.description = `Description must be at least ${VALIDATION.DESCRIPTION_MIN_LENGTH} character`;
    } else if (formData.description.length > VALIDATION.DESCRIPTION_MAX_LENGTH) {
      newErrors.description = `Description must be ${VALIDATION.DESCRIPTION_MAX_LENGTH} characters or less`;
    }

    // Validate duration
    if (!formData.duration) {
      newErrors.duration = 'Duration is required';
    } else if (!DURATION_OPTIONS.find(opt => opt.value === formData.duration)) {
      newErrors.duration = 'Please select a valid duration';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  /**
   * Handle form submission
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Clear previous errors
    setGeneralError('');

    // Check authentication
    if (!authenticated || !user) {
      setGeneralError('You must be logged in to create a debate');
      return;
    }

    // Check if signer is ready
    if (!signerReady || !client) {
      setGeneralError('Wallet is not ready. Please wait a moment and try again.');
      return;
    }

    // Validate form
    if (!validateForm()) {
      return;
    }

    setIsSubmitting(true);

    try {
      logger.info(LogCategory.UI, 'Creating debate', {
        metadata: { topic: formData.topic, duration: formData.duration }
      });

      // Convert duration to minutes for both contract and database (integer)
      const durationMinutes = durationToMinutes(formData.duration);

      // Prepare parameters
      const finalMaxParticipants = useCustomParticipants ? maxParticipants : DEFAULT_MAX_PARTICIPANTS;
      const finalCriteria = useCustomCriteria ? criteria : DEFAULT_EVALUATION_CRITERIA;

      // Deploy contract to blockchain using client from hook
      const { contractAddress } = await deployDebateContract(
        client,
        formData.topic.trim(),
        formData.description.trim(),
        durationMinutes, // Send minutes as integer to contract
        finalMaxParticipants,
        finalCriteria
      );

      logger.info(LogCategory.UI, 'Contract deployed successfully', {
        contractAddress,
        metadata: { topic: formData.topic }
      });

      // HYBRID APPROACH: Try immediate sync with retry, fallback to queue if it fails
      // Database will calculate end_time = created_at + duration_minutes for UI countdown
      // Contract timer starts when first participant joins (for blockchain logic)

      let syncSuccess = false;
      let retryCount = 0;
      const maxRetries = 3;

      while (!syncSuccess && retryCount < maxRetries) {
        try {
          // Calculate end_time for database (timer starts NOW for UI)
          const now = new Date();
          // Calculate end_time using minutes
          const endTime = new Date(now.getTime() + durationMinutes * 60 * 1000);

          // Wait a bit before first retry (give blockchain time to process)
          if (retryCount > 0) {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            console.log(`Retry ${retryCount}/${maxRetries} - Attempting to sync debate...`);
          }

          // Create debate directly in database (no need to fetch from blockchain)
          await supabaseApi.createDebate({
            contract_address: contractAddress,
            topic: formData.topic.trim(),
            description: formData.description.trim(),
            duration_minutes: durationMinutes, // Use minutes (INTEGER)
            end_time: endTime,
            status: 'OPEN',
            participant_count: 0,
            max_participants: finalMaxParticipants, // Custom or default (10)
            last_synced_at: null,
          });

          syncSuccess = true;
          logger.info(LogCategory.UI, 'Debate synced successfully', {
            contractAddress,
            metadata: { topic: formData.topic, retryCount }
          });

          // Show success message
          toast.success('Debate created successfully!', 'Your debate is now live.');

        } catch (syncError) {
          retryCount++;

          if (retryCount >= maxRetries) {
            // Max retries reached, try to queue for background processing
            logger.warn(LogCategory.UI, 'Immediate sync failed after retries, attempting to queue', {
              contractAddress,
              metadata: {
                error: syncError instanceof Error ? syncError.message : String(syncError),
                topic: formData.topic,
                retries: retryCount
              }
            });

            // Skip queueing if sync_queue table doesn't exist yet
            const errorMessage = syncError instanceof Error ? syncError.message : '';
            if (errorMessage.includes('sync_queue') || errorMessage.includes('attempts')) {
              logger.warn(LogCategory.UI, 'Sync queue table not ready, skipping queue', {
                contractAddress,
                metadata: { topic: formData.topic }
              });

              // Show success message anyway (contract is deployed)
              toast.success(
                'Debate created successfully!',
                'Your debate has been deployed. Please refresh the page in a few minutes to see it.'
              );
              break;
            }

            try {
              await supabaseApi.queueSyncOperation({
                sync_type: 'debate_creation',
                contract_address: contractAddress,
                participant_address: null,
                payload: {
                  topic: formData.topic.trim(),
                  description: formData.description.trim(),
                  durationMinutes,
                  creatorAddress: walletAddress,
                },
                attempts: 0,
                max_attempts: 5,
                next_retry_at: new Date(Date.now() + 60000), // Retry in 1 minute
                status: 'pending',
                last_error: null,
              });

              logger.info(LogCategory.UI, 'Debate queued for background sync', {
                contractAddress,
                metadata: { topic: formData.topic }
              });

              // Show success message with note about delay
              toast.success(
                'Debate created successfully!',
                'Your debate will appear in a few minutes as the blockchain processes it.'
              );

            } catch (queueError) {
              // Even queueing failed - log but don't fail the whole operation
              logger.error(
                LogCategory.UI,
                'Failed to queue sync operation',
                queueError instanceof Error ? queueError : new Error(String(queueError))
              );

              // Show success message anyway (contract is deployed)
              toast.success(
                'Debate created successfully!',
                'Your debate has been deployed. Please refresh in a few minutes.'
              );
            }
          }
        }
      }

      // Call success callback or redirect (proceed even if sync failed)
      if (onSuccess) {
        onSuccess(contractAddress);
      } else {
        // Redirect to debates list instead of detail page to avoid read errors
        router.push('/debates');
      }
    } catch (error) {
      logger.error(
        LogCategory.UI,
        'Failed to create debate',
        error instanceof Error ? error : new Error(String(error))
      );

      // Set user-friendly error message
      if (error instanceof Error) {
        setGeneralError(error.message);
      } else {
        setGeneralError('Failed to create debate. Please try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  /**
   * Handle input changes
   */
  const handleChange = (
    field: keyof CreateDebateFormData,
    value: string
  ) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: undefined }));
    }
  };

  // Character counts
  const topicCharCount = formData.topic.length;
  const descriptionCharCount = formData.description.length;

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader className="pb-3 md:pb-6">
        <CardTitle className="text-lg md:text-xl">Create New Debate</CardTitle>
        <CardDescription className="text-xs md:text-sm">
          Start a new debate and invite others to participate. The debate will be judged by AI based on logic, evidence, and clarity.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
          {/* Topic Field */}
          <div className="space-y-2">
            <Label htmlFor="topic" className="text-sm md:text-base">
              Topic <span className="text-red-500">*</span>
            </Label>
            <Input
              id="topic"
              placeholder="Enter debate topic..."
              value={formData.topic}
              onChange={(e) => handleChange('topic', e.target.value)}
              disabled={isSubmitting}
              className={`text-sm md:text-base ${errors.topic ? 'border-red-500' : ''}`}
              maxLength={VALIDATION.TOPIC_MAX_LENGTH}
            />
            <div className="flex justify-between items-start gap-2 text-xs md:text-sm flex-wrap">
              <span className={`flex-1 ${errors.topic ? 'text-red-500' : 'text-muted-foreground'}`}>
                {errors.topic || 'A clear, concise statement of the debate topic'}
              </span>
              <span className={`text-muted-foreground flex-shrink-0 ${topicCharCount > VALIDATION.TOPIC_MAX_LENGTH ? 'text-red-500' : ''}`}>
                {topicCharCount}/{VALIDATION.TOPIC_MAX_LENGTH}
              </span>
            </div>
          </div>

          {/* Description Field */}
          <div className="space-y-2">
            <Label htmlFor="description" className="text-sm md:text-base">
              Description <span className="text-red-500">*</span>
            </Label>
            <Textarea
              id="description"
              placeholder="Provide context and details about the debate..."
              value={formData.description}
              onChange={(e) => handleChange('description', e.target.value)}
              disabled={isSubmitting}
              className={`min-h-[100px] md:min-h-[120px] text-sm md:text-base ${errors.description ? 'border-red-500' : ''}`}
              maxLength={VALIDATION.DESCRIPTION_MAX_LENGTH}
            />
            <div className="flex justify-between items-start gap-2 text-xs md:text-sm flex-wrap">
              <span className={`flex-1 ${errors.description ? 'text-red-500' : 'text-muted-foreground'}`}>
                {errors.description || 'Explain the debate topic, provide context, and set expectations'}
              </span>
              <span className={`text-muted-foreground flex-shrink-0 ${descriptionCharCount > VALIDATION.DESCRIPTION_MAX_LENGTH ? 'text-red-500' : ''}`}>
                {descriptionCharCount}/{VALIDATION.DESCRIPTION_MAX_LENGTH}
              </span>
            </div>
          </div>

          {/* Duration Field */}
          <div className="space-y-2">
            <Label htmlFor="duration" className="text-sm md:text-base">
              Duration <span className="text-red-500">*</span>
            </Label>
            <Select
              value={formData.duration}
              onValueChange={(value) => handleChange('duration', value)}
              disabled={isSubmitting}
            >
              <SelectTrigger id="duration" className={`text-sm md:text-base ${errors.duration ? 'border-red-500' : ''}`}>
                <SelectValue placeholder="Select debate duration" />
              </SelectTrigger>
              <SelectContent>
                {DURATION_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value} className="text-sm md:text-base">
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className={`text-xs md:text-sm ${errors.duration ? 'text-red-500' : 'text-muted-foreground'}`}>
              {errors.duration || 'How long participants have to submit arguments'}
            </p>
          </div>

          {/* Max Participants Field */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm md:text-base font-medium">
                Max Participants
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {useCustomParticipants ? 'Custom' : 'Default (10)'}
                </span>
                <Switch
                  checked={useCustomParticipants}
                  onCheckedChange={setUseCustomParticipants}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {useCustomParticipants && (
              <Select
                value={String(maxParticipants)}
                onValueChange={(value) => setMaxParticipants(Number(value))}
                disabled={isSubmitting}
              >
                <SelectTrigger className="text-sm md:text-base">
                  <SelectValue placeholder="Select max participants" />
                </SelectTrigger>
                <SelectContent>
                  {PARTICIPANT_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={String(option.value)} className="text-sm md:text-base">
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            <p className="text-xs text-muted-foreground">
              {useCustomParticipants
                ? (maxParticipants === 0 ? 'No limit on participants' : `Maximum ${maxParticipants} participants can join`)
                : 'Default allows up to 10 participants'
              }
            </p>
          </div>

          {/* Evaluation Criteria Field */}
          <div className="space-y-3 p-4 border rounded-lg bg-muted/30">
            <div className="flex items-center justify-between">
              <Label className="text-sm md:text-base font-medium">
                Evaluation Criteria
              </Label>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {useCustomCriteria ? 'Custom' : 'Default'}
                </span>
                <Switch
                  checked={useCustomCriteria}
                  onCheckedChange={(checked) => {
                    setUseCustomCriteria(checked);
                    if (!checked) {
                      setCriteria({ ...DEFAULT_EVALUATION_CRITERIA });
                    }
                  }}
                  disabled={isSubmitting}
                />
              </div>
            </div>

            {useCustomCriteria ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Logic & Reasoning</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={criteria.logic_reasoning}
                      onChange={(e) => setCriteria(prev => ({ ...prev, logic_reasoning: Number(e.target.value) || 0 }))}
                      disabled={isSubmitting}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Evidence & Facts</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={criteria.evidence_facts}
                      onChange={(e) => setCriteria(prev => ({ ...prev, evidence_facts: Number(e.target.value) || 0 }))}
                      disabled={isSubmitting}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Clarity</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={criteria.clarity}
                      onChange={(e) => setCriteria(prev => ({ ...prev, clarity: Number(e.target.value) || 0 }))}
                      disabled={isSubmitting}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Relevance</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={criteria.relevance}
                      onChange={(e) => setCriteria(prev => ({ ...prev, relevance: Number(e.target.value) || 0 }))}
                      disabled={isSubmitting}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Originality</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={criteria.originality}
                      onChange={(e) => setCriteria(prev => ({ ...prev, originality: Number(e.target.value) || 0 }))}
                      disabled={isSubmitting}
                      className="text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-xs">Persuasiveness</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={criteria.persuasiveness}
                      onChange={(e) => setCriteria(prev => ({ ...prev, persuasiveness: Number(e.target.value) || 0 }))}
                      disabled={isSubmitting}
                      className="text-sm"
                    />
                  </div>
                </div>

                {/* Total Counter */}
                {(() => {
                  const total = criteria.logic_reasoning + criteria.evidence_facts + criteria.clarity +
                    criteria.relevance + criteria.originality + criteria.persuasiveness;
                  const isValid = total === 100;
                  return (
                    <div className={`flex items-center justify-between p-2 rounded ${isValid ? 'bg-green-100 dark:bg-green-900/30' : 'bg-red-100 dark:bg-red-900/30'}`}>
                      <span className="text-sm font-medium">Total:</span>
                      <span className={`text-sm font-bold ${isValid ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {total}/100 {isValid ? '✓' : `(${total < 100 ? 'Need ' + (100 - total) + ' more' : 'Reduce by ' + (total - 100)})`}
                      </span>
                    </div>
                  );
                })()}
              </div>
            ) : (
              <div className="text-xs text-muted-foreground space-y-1">
                <p>Default weights:</p>
                <p>Logic: 25, Evidence: 20, Clarity: 15, Relevance: 15, Originality: 15, Persuasiveness: 10</p>
              </div>
            )}
          </div>

          {/* General Error Message */}
          {generalError && (
            <div className="p-3 bg-red-50 border border-red-200 rounded-md">
              <p className="text-xs md:text-sm text-red-600 break-words">{generalError}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 justify-end">
            {onCancel && (
              <Button
                type="button"
                variant="outline"
                onClick={onCancel}
                disabled={isSubmitting}
                className="w-full sm:w-auto text-sm md:text-base"
              >
                Cancel
              </Button>
            )}
            <Button
              type="submit"
              disabled={isSubmitting || !authenticated || !signerReady}
              className="w-full sm:w-auto text-sm md:text-base"
            >
              {isSubmitting ? 'Creating Debate...' : 'Create Debate'}
            </Button>
          </div>

          {/* Authentication Warning */}
          {!authenticated && (
            <p className="text-xs md:text-sm text-amber-600 text-center">
              Please log in to create a debate
            </p>
          )}

          {/* Wallet Loading Warning */}
          {authenticated && !signerReady && (
            <p className="text-xs md:text-sm text-amber-600 text-center">
              Initializing wallet...
            </p>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
