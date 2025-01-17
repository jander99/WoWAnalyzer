import { findByBossId, Phase } from 'game/raids';
import { EventType, PhaseEvent } from 'parser/core/Events';
import { WCLFight } from 'parser/core/Fight';
import { PureComponent, ReactNode } from 'react';

export const SELECTION_ALL_PHASES = 'ALL';
export const SELECTION_CUSTOM_PHASE = 'CUSTOM';

interface Props {
  fight: WCLFight;
  bossPhaseEvents: PhaseEvent[];
  children: (isLoading: boolean, phases: { [key: string]: Phase } | null) => ReactNode;
}

interface State {
  isLoading: boolean;
  phases: { [key: string]: Phase } | null;
}

class PhaseParser extends PureComponent<Props, State> {
  state: State = {
    isLoading: true,
    phases: null,
  };

  componentDidMount() {
    // noinspection JSIgnoredPromiseFromCall
    this.parse();
  }
  componentDidUpdate(prevProps: Props) {
    const phasesChanged = this.props.bossPhaseEvents !== prevProps.bossPhaseEvents;
    if (phasesChanged) {
      this.setState({
        isLoading: true,
      });
      // noinspection JSIgnoredPromiseFromCall
      this.parse();
    }
  }

  makePhases(): { [key: string]: Phase } {
    const { bossPhaseEvents, fight } = this.props;
    if (!bossPhaseEvents) {
      return {};
    }
    const distinct = <T>(items: T[]) => Array.from(new Set<T>(items));

    const phaseStarts = distinct(
      bossPhaseEvents
        .filter((e: PhaseEvent) => e.type === EventType.PhaseStart)
        .map((e: PhaseEvent) => e.phase.key),
    ); //distinct phase starts
    const phaseEnds = distinct(
      bossPhaseEvents
        .filter((e: PhaseEvent) => e.type === EventType.PhaseEnd)
        .map((e: PhaseEvent) => e.phase.key),
    ); //distinct phase ends
    const phaseKeys = phaseStarts.filter((e) => phaseEnds.includes(e)); //only include phases that contain start and end event
    const boss = findByBossId(fight.boss);
    const bossPhases = (boss && boss.fight.phases) || {};
    return Object.keys(bossPhases)
      .filter((e) => phaseKeys.includes(e)) //only include boss phases that have a valid phase key
      .reduce((obj, key) => {
        const startInstances = bossPhaseEvents.filter(
          (e: PhaseEvent) => e.type === EventType.PhaseStart && e.phase.key === key,
        );
        const endInstances = bossPhaseEvents.filter(
          (e: PhaseEvent) => e.type === EventType.PhaseEnd && e.phase.key === key,
        );
        return {
          ...obj,
          [key]: {
            ...bossPhases[key],
            //sort start and end by timestamp in case of multiple instances, only keep instances that have both a start and end date
            start: startInstances
              .filter(
                (e: PhaseEvent) =>
                  endInstances.find((e2: PhaseEvent) => e2.phase.instance === e.phase.instance) !==
                  undefined,
              )
              .sort((a: PhaseEvent, b: PhaseEvent) => a.timestamp - b.timestamp)
              .map((e: PhaseEvent) => e.timestamp),
            end: endInstances
              .filter(
                (e: PhaseEvent) =>
                  startInstances.find(
                    (e2: PhaseEvent) => e2.phase.instance === e.phase.instance,
                  ) !== undefined,
              )
              .sort((a: PhaseEvent, b: PhaseEvent) => a.timestamp - b.timestamp)
              .map((e: PhaseEvent) => e.timestamp),
          },
        };
      }, {});
  }

  async parse() {
    const phases = this.makePhases();
    this.setState({
      isLoading: false,
      phases: phases,
    });
  }

  render() {
    return this.props.children(this.state.isLoading, this.state.phases);
  }
}

export default PhaseParser;
