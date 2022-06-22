import { memo, useCallback, useEffect, useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '../Card';
import { BIG_ZERO } from '../../../../helpers/big-number';
import { makeStyles } from '@material-ui/core';
import { styles } from './styles';
import { ToggleButtons } from '../../../../components/ToggleButtons';
import { useTranslation } from 'react-i18next';
import { BreakdownTable } from './components/BreakdownTable';
import { BreakdownMode } from './types';
import { ChartWithLegend } from './components/ChartWithLegend';
import { useCalculatedBreakdown } from './hooks';
import { useAppDispatch, useAppSelector } from '../../../../store';
import { selectVaultById } from '../../../data/selectors/vaults';
import { TokenLpBreakdown } from '../../../data/entities/token';
import { selectLpBreakdownByAddress } from '../../../data/selectors/tokens';
import { VaultEntity } from '../../../data/entities/vault';
import {
  selectIsAddressBookLoaded,
  selectShouldInitAddressBook,
} from '../../../data/selectors/data-loader';
import { fetchAddressBookAction } from '../../../data/actions/tokens';

const useStyles = makeStyles(styles);

export type LiquidityPoolBreakdownProps = {
  vault: VaultEntity;
  breakdown: TokenLpBreakdown;
};
export const LiquidityPoolBreakdown = memo<LiquidityPoolBreakdownProps>(
  function LiquidityPoolBreakdown({ vault, breakdown }) {
    const classes = useStyles();
    const { t } = useTranslation();
    const calculatedBreakdown = useCalculatedBreakdown(vault, breakdown);
    const { userBalance } = calculatedBreakdown;
    const [tab, setTab] = useState<BreakdownMode>(userBalance.gt(BIG_ZERO) ? 'user' : 'one');
    const [haveSwitchedTab, setHaveSwitchedTab] = useState(false);

    const tabs: Partial<Record<BreakdownMode, string>> = useMemo(() => {
      const map = {};
      if (userBalance.gt(BIG_ZERO)) {
        map['user'] = t('Your Deposit'); // TODO translate
      }
      map['one'] = t('1 LP'); // TODO translate
      map['total'] = t('Total Pool'); // TODO translate
      return map;
    }, [userBalance, t]);

    const onTabChange = useCallback(
      (newTab: string) => {
        setTab(newTab as BreakdownMode);
        setHaveSwitchedTab(true);
      },
      [setTab, setHaveSwitchedTab]
    );

    // Switch to 'Your Deposit' tab if user has balance and has not interacted with tabs
    useEffect(() => {
      if (userBalance.gt(BIG_ZERO) && !haveSwitchedTab && tab !== 'user') {
        onTabChange('user');
      }
    }, [userBalance, haveSwitchedTab, onTabChange, tab]);

    return (
      <Card>
        <CardHeader className={classes.header}>
          <CardTitle title={'LP Breakdown'} />
          <ToggleButtons
            buttonsClass={classes.tabs}
            options={tabs}
            onChange={onTabChange}
            value={tab}
          />
        </CardHeader>
        <CardContent disableDefaultClass={true} className={classes.layout}>
          <ChartWithLegend breakdown={calculatedBreakdown} />
          <BreakdownTable mode={tab} breakdown={calculatedBreakdown} />
        </CardContent>
      </Card>
    );
  }
);

type LiquidityPoolBreakdownLoaderProps = {
  vaultId: VaultEntity['id'];
};
export const LiquidityPoolBreakdownLoader = memo<LiquidityPoolBreakdownLoaderProps>(
  function LiquidityPoolBreakdownLoader({ vaultId }) {
    const dispatch = useAppDispatch();
    const vault = useAppSelector(state => selectVaultById(state, vaultId));
    const chainId = vault.chainId;
    const isAddressBookLoaded = useAppSelector(state => selectIsAddressBookLoaded(state, chainId));
    const isPricesLoaded = useAppSelector(
      state => state.ui.dataLoader.global.prices.alreadyLoadedOnce
    );
    const shouldInitAddressBook = useAppSelector(state =>
      selectShouldInitAddressBook(state, chainId)
    );
    const breakdown = useAppSelector(state =>
      selectLpBreakdownByAddress(state, chainId, vault.depositTokenAddress)
    );
    const haveBreakdownData = useAppSelector(state => {
      if (
        !isPricesLoaded ||
        !isAddressBookLoaded ||
        !breakdown ||
        !breakdown.tokens ||
        !breakdown.tokens.length ||
        !breakdown.balances ||
        breakdown.balances.length !== breakdown.tokens.length
      ) {
        return false;
      }

      const tokens = breakdown.tokens.map(
        address => state.entities.tokens.byChainId[vault.chainId].byAddress[address.toLowerCase()]
      );
      if (tokens.find(token => !token) === undefined) {
        return false;
      }

      return (
        tokens.find(token => !!state.entities.tokens.prices.byOracleId[token.oracleId]) ===
        undefined
      );
    });

    // Load address book if needed
    useEffect(() => {
      if (!isAddressBookLoaded && shouldInitAddressBook) {
        dispatch(fetchAddressBookAction({ chainId: chainId }));
      }
    }, [dispatch, isAddressBookLoaded, shouldInitAddressBook, chainId]);

    if (haveBreakdownData) {
      return <LiquidityPoolBreakdown vault={vault} breakdown={breakdown} />;
    }

    return null;
  }
);
