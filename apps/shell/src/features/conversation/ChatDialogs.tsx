import { ActionSheet } from './ActionSheet';
import { ReactionPicker } from './ReactionPicker';
import { ForwardDialog } from './ForwardDialog';
import { InfoDialog } from './InfoDialog';
import { VerifyDialog } from './VerifyDialog';

export function ChatDialogs({ peer, name }: { peer: string; name: string }) {
  return (
    <>
      <ActionSheet />
      <ReactionPicker />
      <ForwardDialog />
      <InfoDialog />
      <VerifyDialog peer={peer} name={name} />
    </>
  );
}
